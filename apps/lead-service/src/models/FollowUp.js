const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
        assignedUserId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
        
        type: {
            type: String,
            enum: ['call', 'whatsapp', 'email', 'meeting', 'other'],
            default: 'call',
        },
        
        status: {
            type: String,
            enum: ['scheduled', 'completed', 'missed', 'cancelled'],
            default: 'scheduled',
            index: true,
        },
        
        scheduledAt: { type: Date, required: true, index: true },
        note: { type: String, trim: true, default: '' },
        
        reminderMinutesBefore: { type: Number, default: 0 },
        reminderSentAt: { type: Date, default: null },
        
        completedAt: { type: Date, default: null },
        completedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        
        cancelledAt: { type: Date, default: null },
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        
        rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, default: null },
        rescheduleReason: { type: String, trim: true, default: '' },

        meta: {
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

// Indexes for performance
followUpSchema.index({ tenantId: 1, leadId: 1, status: 1 });
followUpSchema.index({ tenantId: 1, assignedUserId: 1, status: 1, scheduledAt: 1 });
followUpSchema.index({ tenantId: 1, branchId: 1, scheduledAt: 1 });

const FollowUp = mongoose.model('FollowUp', followUpSchema);
module.exports = FollowUp;
