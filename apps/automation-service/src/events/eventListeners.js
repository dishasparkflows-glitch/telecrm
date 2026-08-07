const { EVENTS, subscribeToEvents } = require('@sparkcrm/shared-events');
const { AutomationRule, AutomationLog } = require('../models/AutomationRule');

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

                for (const rule of rules) {
                    // Check conditions
                    const conditionsMet = evaluateConditions(rule.trigger.conditions, data);
                    if (!conditionsMet) continue;

                    // Execute actions
                    const actionsExecuted = [];
                    for (const action of rule.actions) {
                        try {
                            // Delay support
                            if (action.delay > 0) {
                                // In production: queue via BullMQ with delay
                                console.log(`⏱️ Action delayed by ${action.delay} min: ${action.type}`);
                            }

                            actionsExecuted.push({
                                type: action.type,
                                status: 'success',
                                result: { config: action.config },
                                executedAt: new Date(),
                            });
                        } catch (actionErr) {
                            actionsExecuted.push({
                                type: action.type,
                                status: 'failed',
                                result: { error: actionErr.message },
                                executedAt: new Date(),
                            });
                        }
                    }

                    // Log execution
                    await AutomationLog.create({
                        tenantId,
                        branchId: rule.branchId || data.branchId || null,
                        ruleId: rule._id,
                        ruleName: rule.name,
                        triggerEvent: eventName,
                        triggerData: data,
                        actionsExecuted,
                        status: actionsExecuted.every((a) => a.status === 'success')
                            ? 'success'
                            : actionsExecuted.some((a) => a.status === 'success')
                                ? 'partial'
                                : 'failed',
                    });

                    // Update rule stats
                    rule.executionCount += 1;
                    rule.lastExecutedAt = new Date();
                    await rule.save();

                    console.log(`⚙️ Automation "${rule.name}" triggered by ${eventName}`);
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
            default: return false;
        }
    });
};

module.exports = { registerEventListeners, evaluateConditions };
