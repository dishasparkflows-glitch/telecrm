const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        details: {
            title: { type: String, required: true, trim: true },
            description: { type: String, trim: true, default: '' },
            status: {
                type: String,
                enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
                default: 'PENDING',
                index: true,
            },
            priority: {
                type: String,
                enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                default: 'MEDIUM',
                index: true,
            },
            completedAt: { type: Date, default: null },
            taskType: { type: String, default: 'Follow-up' },
            reminder: { type: String, default: null }
        },
        
        // Polymorphic reference replacing leadId
        relatedEntity: {
            entityType: { type: String, enum: ['lead', 'meeting', 'call', 'other'], default: 'lead', index: true },
            entityId: { type: mongoose.Schema.Types.ObjectId, index: true, default: null }
        },
        
        assignedTo: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        
        dueDate: { type: Date, default: null, index: true },
        
        source: {
            type: String,
            enum: ['MANUAL', 'AUTOMATION'],
            default: 'MANUAL',
        },
        automationId: { type: mongoose.Schema.Types.ObjectId },
        
        attachments: [{ type: mongoose.Schema.Types.Mixed }],
        internalNote: { type: String, default: '' },

        meta: {
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            createdBy: { type: mongoose.Schema.Types.ObjectId, required: true }
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

// Indexes for performance
taskSchema.index({ tenantId: 1, assignedTo: 1, 'details.status': 1, dueDate: 1 });
taskSchema.index({ tenantId: 1, 'relatedEntity.entityType': 1, 'relatedEntity.entityId': 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
