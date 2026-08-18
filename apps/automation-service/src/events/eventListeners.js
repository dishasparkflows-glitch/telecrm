const { EVENTS, subscribeToEvents } = require('@sparkcrm/shared-events');
const { AutomationRule, AutomationLog } = require('../models/AutomationRule');
const { connection } = require('../queue/automationQueue');

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

                // Find matching active rules for this event
                const rules = await AutomationRule.find({
                    tenantId,
                    status: 'active',
                    type: 'workflow',
                    'trigger.event': eventName,
                    $or: [
                        { branchId: null },
                        { branchId: branchId || null }
                    ]
                });

                if (!rules.length) return;

                const entityId = data._id || data.leadId || data.formId || data.id || 'unknown';

                for (const rule of rules) {
                    // Loop Protection / Idempotency Check
                    if (entityId !== 'unknown') {
                        const lockKey = `automation_lock:${rule._id}:${entityId}:${eventName}`;
                        const isLocked = await connection.get(lockKey);
                        if (isLocked) {
                            console.log(`🔒 Loop protection triggered for rule ${rule._id} on entity ${entityId}`);
                            continue;
                        }
                        await connection.set(lockKey, '1', 'EX', 60); // 60 seconds cooldown
                    }

                    // Check rule trigger conditions (if any remain at the root level)
                    // Note: with nodes, conditions might be explicit condition nodes, but root filters can still apply
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

                    // Dispatch to queue
                    const { enqueueAction } = require('../queue/automationQueue');
                    try {
                        await enqueueAction(log._id, tenantId, nextNode, data);
                    } catch (err) {
                        console.error(`❌ Failed to enqueue node ${nextNode.type}:`, err.message);
                    }

                    // Update rule stats
                    rule.executionCount += 1;
                    rule.lastExecutedAt = new Date();
                    await rule.save();

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
        // Resolve dot-notation for nested fields like customData.budget
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
            // Dates (simplified string comparison, assuming ISO formats)
            case 'before': return new Date(fieldValue) < new Date(cond.value);
            case 'after': return new Date(fieldValue) > new Date(cond.value);
            case 'on': return new Date(fieldValue).toDateString() === new Date(cond.value).toDateString();
            case 'before_or_equal': return new Date(fieldValue) <= new Date(cond.value);
            case 'after_or_equal': return new Date(fieldValue) >= new Date(cond.value);
            default: return false;
        }
    });
};

module.exports = { registerEventListeners, evaluateConditions };
