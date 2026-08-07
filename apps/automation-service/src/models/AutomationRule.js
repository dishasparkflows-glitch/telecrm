const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        trigger: {
            event: { type: String, required: true }, // e.g., 'lead.created', 'lead.stage_changed', 'form.submitted'
            conditions: [
                {
                    field: { type: String, required: true }, // e.g., 'source', 'stage', 'score'
                    operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in'], required: true },
                    value: { type: mongoose.Schema.Types.Mixed, required: true },
                },
            ],
        },
        actions: [
            {
                type: { type: String, enum: ['assign_lead', 'send_email', 'send_whatsapp', 'change_stage', 'add_tag', 'create_task', 'send_notification', 'webhook'], required: true },
                config: { type: mongoose.Schema.Types.Mixed, default: {} },
                delay: { type: Number, default: 0 }, // minutes
            },
        ],
        executionCount: { type: Number, default: 0 },
        lastExecutedAt: { type: Date, default: null },
        createdBy: { type: mongoose.Schema.Types.ObjectId },
    },
    { timestamps: true }
);

automationRuleSchema.index({ tenantId: 1, isActive: 1, 'trigger.event': 1 });

const automationLogSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule', required: true },
        ruleName: { type: String },
        triggerEvent: { type: String },
        triggerData: { type: mongoose.Schema.Types.Mixed },
        actionsExecuted: [
            {
                type: { type: String },
                status: { type: String, enum: ['success', 'failed', 'skipped'] },
                result: { type: mongoose.Schema.Types.Mixed },
                executedAt: { type: Date, default: Date.now },
            },
        ],
        status: { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },
    },
    { timestamps: true }
);

automationLogSchema.index({ tenantId: 1, createdAt: -1 });

const AutomationRule = mongoose.model('AutomationRule', automationRuleSchema);
const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);

module.exports = { AutomationRule, AutomationLog };
