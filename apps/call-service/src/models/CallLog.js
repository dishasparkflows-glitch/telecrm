const mongoose = require('mongoose');
const { CALL_STATUS, CALL_DISPOSITION } = require('@sparkcrm/shared-utils');

const callLogSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, index: true, default: null },
        call: {
            initiatedAt: { type: Date, default: null },
            answeredAt: { type: Date, default: null },
            endedAt: { type: Date, default: null },
            direction: { type: String, enum: ['outbound', 'inbound'], default: 'outbound' },
            status: { type: String, enum: Object.values(CALL_STATUS), default: CALL_STATUS.INITIATED },
            duration: { type: Number, default: 0 }, // seconds
            from: { type: String, required: true },
            to: { type: String, required: true }
        },
        provider: {
            type: mongoose.Schema.Types.Mixed,
            default: { name: 'exotel', externalCallId: null, data: {} }
        },
        recording: {
            status: { type: String, enum: ['none', 'pending', 'available', 'failed', 'processing', 'ready', 'unavailable'], default: 'none' },
            url: { type: String, default: null },
            objectKey: { type: String, default: null },
            mimeType: { type: String, default: '' },
            duration: { type: Number, default: 0 },
            fetchedAt: { type: Date, default: null }
        },
        disposition: {
            code: { type: String, enum: Object.values(CALL_DISPOSITION) },
            notes: { type: String },
            updatedAt: { type: Date },
            updatedBy: { type: mongoose.Schema.Types.ObjectId }
        },
        mobile: {
            deviceId: { type: String, index: true },
            simSlot: { type: Number},
            simLabel: { type: String },
            phoneNumber: { type: String },
            syncedAt: { type: Date }
        },
        events: {
            pending: { type: [mongoose.Schema.Types.Mixed] },
            processed: { type: [String] }
        },
        notes: { type: String },
        callbackAt: { type: Date },
        audit: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date }
        }
    },
    { 
        timestamps: { createdAt: 'audit.createdAt', updatedAt: 'audit.updatedAt' }, 
        versionKey: false,
        collection: 'call_logs'
    }
);

callLogSchema.index({ tenantId: 1, userId: 1, 'audit.createdAt': -1 });
callLogSchema.index({ tenantId: 1, leadId: 1, 'audit.createdAt': -1 });

const CallLog = mongoose.model('CallLog', callLogSchema);
module.exports = CallLog;
