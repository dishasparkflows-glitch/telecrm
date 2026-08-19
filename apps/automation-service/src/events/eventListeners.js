const { EVENTS, subscribeToEvents } = require('@sparkcrm/shared-events');
const { AutomationRule, AutomationLog } = require('../models/AutomationRule');
const IORedis = require('ioredis');
const { env } = require('@sparkcrm/shared-config');

// Dedicated Redis client for distributed locks and rule caching.
// Must NOT be the BullMQ queue/worker connection — using those for arbitrary
// GET/SET while BullMQ uses blocking commands causes race conditions.
let lockClient = null;
const getLockClient = () => {
    if (!lockClient) {
        lockClient = new IORedis(env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 500, 10000),
            lazyConnect: true,
        });
        lockClient.connect().catch((err) => {
            console.warn('⚠️  Automation lock Redis unavailable:', err.message);
        });
    }
    return lockClient;
};

// ─── Rule Cache ──────────────────────────────────────────────────────────────
// Active automation rules are cached in Redis per tenant (TTL 60s).
// Without this, every incoming event (e.g. 100 leads/min) triggers a DB query.
const RULE_CACHE_TTL = 60; // seconds

const getCachedRules = async (tenantId, eventName) => {
    try {
        const redis = getLockClient();
        const cacheKey = `automation_rules:${tenantId}:${eventName}`;
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    } catch { /* cache miss — fall through to DB */ }
    return null;
};

const setCachedRules = async (tenantId, eventName, rules) => {
    try {
        const redis = getLockClient();
        const cacheKey = `automation_rules:${tenantId}:${eventName}`;
        await redis.set(cacheKey, JSON.stringify(rules), 'EX', RULE_CACHE_TTL);
    } catch { /* non-critical, ignore cache write errors */ }
};

/**
 * Invalidate the rule cache for a tenant (call this when a rule is saved/deleted).
 */
const invalidateRuleCache = async (tenantId) => {
    try {
        const redis = getLockClient();
        const keys = await redis.keys(`automation_rules:${tenantId}:*`);
        if (keys.length > 0) await redis.del(...keys);
    } catch { /* non-critical */ }
};

/**
 * Wire up event listeners for automation-service
 * Listens to events and matches them against stored rules
 */
const registerEventListeners = async () => {
    console.log('📡 automation-service: Registering event listeners...');

    const eventsToListen = [
        EVENTS.LEAD_CREATED,
        EVENTS.LEAD_STAGE_CHANGED,
        EVENTS.LEAD_ASSIGNED,
        EVENTS.CALL_COMPLETED,
        EVENTS.CALL_MISSED,
        EVENTS.FORM_SUBMITTED,
        EVENTS.MEETING_BOOKED,
        EVENTS.WHATSAPP_MESSAGE_RECEIVED,
    ];

    for (const eventName of eventsToListen) {
        await subscribeToEvents(eventName, async (_channel, data, _timestamp) => {
            try {
                const { tenantId } = data;
                if (!tenantId) return;

                const branchId = data.branchId;

                // Try cache first; fall back to DB and warm the cache
                let rules = await getCachedRules(tenantId, eventName);
                if (!rules) {
                    rules = await AutomationRule.find({
                        tenantId,
                        status: 'active',
                        type: 'workflow',
                        'trigger.event': eventName,
                        $or: [
                            { branchId: null },
                            { branchId: branchId || null }
                        ]
                    }).lean();
                    await setCachedRules(tenantId, eventName, rules);
                }

                if (!rules.length) return;

                const entityId = data._id || data.leadId || data.formId || data.id || 'unknown';
                const redis = getLockClient();

                for (const rule of rules) {
                    // Loop Protection / Idempotency Check
                    if (entityId !== 'unknown') {
                        const lockKey = `automation_lock:${rule._id}:${entityId}:${eventName}`;
                        // Use SET NX (atomic) for the lock — safer than GET then SET
                        const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');
                        if (!acquired) {
                            console.log(`🔒 Loop protection triggered for rule ${rule._id} on entity ${entityId}`);
                            continue;
                        }
                    }

                    // Check rule trigger conditions
                    const conditionsMet = evaluateConditions(rule.trigger.conditions || [], data);
                    if (!conditionsMet) continue;

                    // Find trigger node
                    const triggerNode = rule.nodes.find(n => n.type === 'trigger');
                    if (!triggerNode) {
                        console.warn(`⚠️ Automation "${rule.name}" has no trigger node. Skipping.`);
                        continue;
                    }

                    const { findNextNode } = require('../engine/workflowEngine');
                    const nextNode = findNextNode(rule, triggerNode.id);

                    if (!nextNode) {
                        console.log(`⚙️ Automation "${rule.name}" triggered, but no subsequent nodes found.`);
                        continue;
                    }

                    // Create pending log
                    const log = await AutomationLog.create({
                        tenantId,
                        branchId: rule.branchId || data.branchId || null,
                        ruleId: rule._id,
                        ruleName: rule.name,
                        triggerEvent: eventName,
                        triggerData: data,
                        currentNodeId: nextNode.id,
                        nodeExecutions: [],
                        status: 'running',
                    });

                    // Embed rule graph in job payload — worker uses this to find
                    // next nodes without DB queries (eliminates N+1 on every node completion).
                    const ruleGraph = {
                        ruleId: rule._id,
                        nodes: rule.nodes,
                        edges: rule.edges,
                    };

                    const { enqueueAction } = require('../queue/automationQueue');
                    try {
                        await enqueueAction(log._id, tenantId, nextNode, data, ruleGraph);
                    } catch (err) {
                        console.error(`❌ Failed to enqueue node ${nextNode.type}:`, err.message);
                    }

                    // Update rule stats (non-blocking, best-effort)
                    AutomationRule.updateOne(
                        { _id: rule._id },
                        { $inc: { executionCount: 1 }, $set: { lastExecutedAt: new Date() } }
                    ).catch(() => {});

                    console.log(`⚙️ Automation "${rule.name}" triggered by ${eventName}. Queued first node: ${nextNode.type}.`);
                }
            } catch (err) {
                console.error(`❌ automation ${eventName} handler error:`, err.message);
            }
        });
    }

    console.log(`✅ automation-service: ${eventsToListen.length} event listeners registered`);
};

/**
 * Evaluate rule conditions against event data
 */
const evaluateConditions = (conditions, data) => {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every((cond) => {
        const resolveField = (obj, path) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
        const fieldValue = resolveField(data, cond.field);

        const valA = fieldValue !== undefined && fieldValue !== null ? String(fieldValue).toLowerCase() : '';
        const valB = cond.value !== undefined && cond.value !== null ? String(cond.value).toLowerCase() : '';

        switch (cond.operator) {
            case 'equals': return valA === valB;
            case 'not_equals': return valA !== valB;
            case 'contains': return valA.includes(valB);
            case 'does_not_contain': return !valA.includes(valB);
            case 'starts_with': return valA.startsWith(valB);
            case 'ends_with': return valA.endsWith(valB);
            case 'greater_than': return Number(fieldValue) > Number(cond.value);
            case 'less_than': return Number(fieldValue) < Number(cond.value);
            case 'greater_than_or_equal': return Number(fieldValue) >= Number(cond.value);
            case 'less_than_or_equal': return Number(fieldValue) <= Number(cond.value);
            case 'in': return Array.isArray(cond.value) ? cond.value.some(v => String(v).toLowerCase() === valA) : false;
            case 'not_in': return Array.isArray(cond.value) ? !cond.value.some(v => String(v).toLowerCase() === valA) : true;
            case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
            case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
            case 'is_true': return Boolean(fieldValue) === true;
            case 'is_false': return Boolean(fieldValue) === false;
            case 'before': return new Date(fieldValue) < new Date(cond.value);
            case 'after': return new Date(fieldValue) > new Date(cond.value);
            case 'on': return new Date(fieldValue).toDateString() === new Date(cond.value).toDateString();
            case 'before_or_equal': return new Date(fieldValue) <= new Date(cond.value);
            case 'after_or_equal': return new Date(fieldValue) >= new Date(cond.value);
            default: return false;
        }
    });
};

module.exports = { registerEventListeners, evaluateConditions, invalidateRuleCache };
