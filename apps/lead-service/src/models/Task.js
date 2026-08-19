const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        
        leadId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        leadNumber: { type: String, default: null },
        
        assignedTo: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
        
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
        
        dueDate: { type: Date, default: null, index: true },
        completedAt: { type: Date, default: null },
        
        source: {
            type: String,
            enum: ['MANUAL', 'AUTOMATION'],
            default: 'MANUAL',
        },
        automationId: { type: mongoose.Schema.Types.ObjectId, default: null },
        
        meta: {
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

// Indexes for performance
taskSchema.index({ tenantId: 1, assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ tenantId: 1, leadId: 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
