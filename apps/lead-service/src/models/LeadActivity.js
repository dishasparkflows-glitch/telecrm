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
    },
    { timestamps: true }
);

leadActivitySchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
leadActivitySchema.index({ tenantId: 1, type: 1, createdAt: -1 });

const LeadActivity = mongoose.model('LeadActivity', leadActivitySchema);
module.exports = LeadActivity;
