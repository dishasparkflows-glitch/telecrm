const mongoose = require('mongoose');
const { CALL_STATUS, CALL_DISPOSITION } = require('@sparkcrm/shared-utils');

const callLogSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, index: true },
        callerId: { type: mongoose.Schema.Types.ObjectId, required: true }, // User who made the call
        callerName: { type: String, default: '' },
        fromNumber: { type: String, required: true },
        toNumber: { type: String, required: true },
        direction: { type: String, enum: ['outbound', 'inbound'], default: 'outbound' },
        status: { type: String, enum: Object.values(CALL_STATUS), default: CALL_STATUS.INITIATED },
        disposition: { type: String, enum: Object.values(CALL_DISPOSITION), default: null },
        duration: { type: Number, default: 0 }, // seconds
        recordingUrl: { type: String, default: null },
        recordingObjectKey: { type: String, default: null, select: false },
        recordingStatus: { type: String, enum: ['none', 'pending', 'available', 'failed'], default: 'none' },
        recordingMimeType: { type: String, default: '' },
        recordingDuration: { type: Number, default: 0 },
        notes: { type: String, default: '' },
        callbackAt: { type: Date, default: null },
        // Exotel/Twilio specific
        externalCallId: { type: String, default: null },
        provider: { type: String, enum: ['exotel', 'twilio', 'mobile'], default: 'exotel' },
        providerData: { type: mongoose.Schema.Types.Mixed, default: {} },
        deviceId: { type: String, default: '', index: true },
        simSlot: { type: Number, default: null },
        simLabel: { type: String, default: '' },
        simPhoneNumber: { type: String, default: '' },
        syncedAt: { type: Date, default: null },
        pendingEvents: { type: [mongoose.Schema.Types.Mixed], default: [] },
        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false }
);

callLogSchema.index({ tenantId: 1, callerId: 1, createdAt: -1 });
callLogSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
callLogSchema.index({ externalCallId: 1 });
callLogSchema.index(
    { tenantId: 1, callerId: 1, provider: 1, externalCallId: 1 },
    { unique: true, partialFilterExpression: { externalCallId: { $type: 'string' } } }
);

const CallLog = mongoose.model('CallLog', callLogSchema);
module.exports = CallLog;
