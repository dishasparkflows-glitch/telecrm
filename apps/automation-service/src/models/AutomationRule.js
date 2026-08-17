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
                    operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in', 'is_empty', 'is_not_empty'], required: true },
                    value: { type: mongoose.Schema.Types.Mixed },
                },
            ],
        },
        actions: [
            {
                type: { type: String, enum: ['assign_lead', 'send_email', 'send_whatsapp', 'change_stage', 'change_status', 'add_tag', 'create_task', 'create_follow_up', 'send_notification', 'webhook'], required: true },
                config: { type: mongoose.Schema.Types.Mixed, default: {} },
                delay: { type: Number, default: 0 }, // minutes
                conditions: [
                    {
                        field: { type: String, required: true },
                        operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in', 'is_empty', 'is_not_empty'], required: true },
                        value: { type: mongoose.Schema.Types.Mixed },
                    }
                ]
            },
        ],
        executionCount: { type: Number, default: 0 },
        lastExecutedAt: { type: Date, default: null },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, 
        versionKey: false,
        collection: 'automation_rules'
    }
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
                status: { type: String, enum: ['pending', 'success', 'failed', 'skipped'] },
                result: { type: mongoose.Schema.Types.Mixed },
                executedAt: { type: Date, default: Date.now },
            },
        ],
        status: { type: String, enum: ['pending', 'success', 'partial', 'failed'], default: 'pending' },
    
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, 
        versionKey: false,
        collection: 'automation_logs'
    }
);

automationLogSchema.index({ tenantId: 1, createdAt: -1 });

const AutomationRule = mongoose.model('AutomationRule', automationRuleSchema);
const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);

module.exports = { AutomationRule, AutomationLog };
