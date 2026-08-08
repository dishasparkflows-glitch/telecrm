const mongoose = require('mongoose');

const leadActivitySchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
        actorType: {
            type: String,
            enum: ['user', 'system', 'integration', 'automation'],
            default: 'system',
        },
        type: {
            type: String,
            required: true,
            index: true,
        },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

leadActivitySchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
leadActivitySchema.index({ tenantId: 1, type: 1, createdAt: -1 });

const LeadActivity = mongoose.model('LeadActivity', leadActivitySchema);
module.exports = LeadActivity;
