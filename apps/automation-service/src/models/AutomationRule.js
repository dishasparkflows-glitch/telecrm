const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        type: { type: String, enum: ['workflow', 'schedule'], default: 'workflow', index: true },
        status: { type: String, enum: ['draft', 'active', 'inactive'], default: 'draft', index: true },
        trigger: {
            event: { type: String }, // e.g., 'lead.created'
            schedule: {
                frequency: { type: String, enum: ['once', 'daily', 'weekly', 'monthly'] },
                timezone: { type: String },
                time: { type: String },
                startDate: { type: Date },
                endDate: { type: Date }
            },
            audience: {
                filters: [{ type: mongoose.Schema.Types.Mixed }]
            }
        },
        nodes: [
            {
                id: { type: String, required: true }, // UI generated node ID
                type: { type: String, enum: ['trigger', 'condition', 'action', 'wait'], required: true },
                actionType: { type: String }, // For 'action' nodes (e.g. 'assign_lead')
                config: { type: mongoose.Schema.Types.Mixed, default: {} },
                conditions: [
                    {
                        field: { type: String, required: true },
                        operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'does_not_contain', 'starts_with', 'ends_with', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'is_empty', 'is_not_empty', 'is_true', 'is_false', 'in', 'not_in', 'before', 'after', 'on', 'before_or_equal', 'after_or_equal'], required: true },
                        value: { type: mongoose.Schema.Types.Mixed },
                    }
                ],
                delay: {
                    value: { type: Number },
                    unit: { type: String, enum: ['minutes', 'hours', 'days'] }
                }
            }
        ],
        edges: [
            {
                id: { type: String, required: true },
                source: { type: String, required: true },
                target: { type: String, required: true },
                sourceHandle: { type: String } // e.g., 'true', 'false' for condition branching
            }
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

automationRuleSchema.index({ tenantId: 1, status: 1, 'trigger.event': 1 });

const automationLogSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule', required: true },
        ruleName: { type: String },
        triggerEvent: { type: String },
        triggerData: { type: mongoose.Schema.Types.Mixed },
        currentNodeId: { type: String },
        nodeExecutions: [
            {
                nodeId: { type: String, required: true },
                type: { type: String },
                status: { type: String, enum: ['pending', 'success', 'failed', 'skipped', 'waiting', 'exited'] },
                result: { type: mongoose.Schema.Types.Mixed },
                executedAt: { type: Date, default: Date.now },
            },
        ],
        status: { type: String, enum: ['running', 'waiting', 'completed', 'failed', 'exited'], default: 'running' },
    
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
