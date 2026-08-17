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
                // Rule must match tenant AND (be global OR match specific branch)
                const rules = await AutomationRule.find({
                    tenantId,
                    isActive: true,
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

                    // Check rule trigger conditions
                    const conditionsMet = evaluateConditions(rule.trigger.conditions, data);
                    if (!conditionsMet) continue;

                    // Filter actions based on action conditions (Branch evaluation)
                    const validActions = [];
                    const actionsExecuted = [];
                    for (const action of rule.actions) {
                        const actionConditionsMet = evaluateConditions(action.conditions, data);
                        if (actionConditionsMet) {
                            validActions.push(action);
                            actionsExecuted.push({
                                _id: action._id,
                                type: action.type,
                                status: 'pending',
                                result: null,
                                executedAt: new Date(),
                            });
                        } else {
                            actionsExecuted.push({
                                _id: action._id,
                                type: action.type,
                                status: 'skipped',
                                result: 'Branch condition not met',
                                executedAt: new Date(),
                            });
                        }
                    }

                    // Create pending log
                    const log = await AutomationLog.create({
                        tenantId,
                        branchId: rule.branchId || data.branchId || null,
                        ruleId: rule._id,
                        ruleName: rule.name,
                        triggerEvent: eventName,
                        triggerData: data,
                        actionsExecuted,
                        status: validActions.length > 0 ? 'pending' : 'success', // If all skipped, it's a success
                    });

                    // Dispatch to queue
                    const { enqueueAction } = require('../queue/automationQueue');
                    for (const action of validActions) {
                        try {
                            await enqueueAction(log._id, tenantId, action, data);
                        } catch (err) {
                            console.error(`❌ Failed to enqueue action ${action.type}:`, err.message);
                        }
                    }

                    // Update rule stats
                    rule.executionCount += 1;
                    rule.lastExecutedAt = new Date();
                    await rule.save();

                    console.log(`⚙️ Automation "${rule.name}" triggered by ${eventName}. Queued ${validActions.length} actions.`);
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
        const fieldValue = data[cond.field];
        switch (cond.operator) {
            case 'equals': return fieldValue === cond.value;
            case 'not_equals': return fieldValue !== cond.value;
            case 'contains': return String(fieldValue || '').includes(cond.value);
            case 'greater_than': return Number(fieldValue) > Number(cond.value);
            case 'less_than': return Number(fieldValue) < Number(cond.value);
            case 'in': return Array.isArray(cond.value) ? cond.value.includes(fieldValue) : false;
            case 'not_in': return Array.isArray(cond.value) ? !cond.value.includes(fieldValue) : true;
            case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
            case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
            default: return false;
        }
    });
};

module.exports = { registerEventListeners, evaluateConditions };
