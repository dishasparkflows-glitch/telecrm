const mongoose = require('mongoose');

const removePrivateMediaKey = (_doc, value) => {
    delete value.mediaObjectKey;
    return value;
};

const replySnapshotSchema = new mongoose.Schema({
    waMessageId: { type: String, default: null },
    direction: { type: String, enum: ['inbound', 'outbound', null], default: null },
    from: { type: String, default: null },
    to: { type: String, default: null },
    type: { type: String, default: 'text' },
    content: { type: String, default: '' },
    mediaName: { type: String, default: null },
    mediaMimeType: { type: String, default: null },
    provider: { type: String, default: null },
}, { _id: false });

const replyToSchema = new mongoose.Schema({
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsappMessage', default: null },
    waMessageId: { type: String, default: null },
    participant: { type: String, default: null },
    snapshot: { type: replySnapshotSchema, default: null },
}, { _id: false });

const forwardedFromSchema = new mongoose.Schema({
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsappMessage', default: null },
    waMessageId: { type: String, default: null },
    provider: { type: String, default: null },
    mode: { type: String, enum: ['native', 'resend'], required: true },
}, { _id: false });

const reactionSchema = new mongoose.Schema({
    actorUserId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorPhone: { type: String, default: null },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    emoji: { type: String, default: '' },
    provider: { type: String, enum: ['baileys', 'cloud'], required: true },
    providerMessageId: { type: String, default: null },
    reactedAt: { type: Date, default: Date.now },
}, { _id: false });

const whatsappMessageSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, default: null },
        direction: { type: String, enum: ['inbound', 'outbound'], required: true },
        from: { type: String, required: true },
        to: { type: String, required: true },
        type: { type: String, enum: ['text', 'image', 'video', 'document', 'audio', 'template', 'interactive'], default: 'text' },
        content: { type: String, default: '' },
        mediaUrl: { type: String, default: null },
        mediaObjectKey: { type: String, default: null, select: false },
        mediaName: { type: String, default: null },
        mediaMimeType: { type: String, default: null },
        mediaSize: { type: Number, default: null },
        templateName: { type: String, default: null },
        status: { type: String, enum: ['queued', 'sent', 'delivered', 'read', 'failed', 'received'], default: 'queued' },
        waMessageId: { type: String, default: null },
        provider: { type: String, enum: ['baileys', 'cloud'], default: null },
        providerMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        replyTo: { type: replyToSchema, default: null },
        isForwarded: { type: Boolean, default: false },
        forwardedFrom: { type: forwardedFromSchema, default: null },
        reactions: { type: [reactionSchema], default: [] },
        eventPublishedAt: { type: Date, default: null },
        eventError: { type: String, default: '' },
        // Omit this field for normal chat messages. A sparse/partial unique
        // index must never receive explicit null values from non-queued sends.
        idempotencyKey: { type: String, default: undefined },
        deliveryPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
        sendAttempts: { type: Number, default: 0 },
        processingAt: { type: Date, default: null },
        nextAttemptAt: { type: Date, default: null },
        lastError: { type: String, default: '' },
        pendingEvents: { type: [mongoose.Schema.Types.Mixed], default: [] },
        automationType: { type: String, default: '' },
        isRead: { type: Boolean, default: false },
        readAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: { transform: removePrivateMediaKey },
        toObject: { transform: removePrivateMediaKey },
    }
);

whatsappMessageSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
whatsappMessageSchema.index({ tenantId: 1, from: 1, createdAt: -1 });
whatsappMessageSchema.index({ waMessageId: 1 });
whatsappMessageSchema.index(
    { idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
whatsappMessageSchema.index({ status: 1, nextAttemptAt: 1, processingAt: 1 });

const templateSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        name: { type: String, required: true },
        language: { type: String, default: 'en' },
        category: { type: String, enum: ['marketing', 'utility', 'authentication'], default: 'utility' },
        body: { type: String, required: true },
        headerType: { type: String, enum: ['none', 'text', 'image', 'video', 'document'], default: 'none' },
        headerContent: { type: String, default: '' },
        footer: { type: String, default: '' },
        buttons: [{ type: { type: String }, text: String, url: String, phoneNumber: String }],
        variables: { type: [mongoose.Schema.Types.Mixed], default: [] },
        waTemplateId: { type: String, default: null },
        status: { type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft' },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

templateSchema.index({ tenantId: 1, name: 1 });

const chatbotRuleSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        triggerKeyword: { type: String, required: true },
        matchType: { type: String, enum: ['exact', 'contains', 'startsWith'], default: 'contains' },
        responseType: { type: String, enum: ['text', 'template', 'menu'], default: 'text' },
        responseContent: { type: String, required: true },
        templateName: { type: String, default: null },
        isActive: { type: Boolean, default: true },
        priority: { type: Number, default: 0 },
    },
    { timestamps: true }
);

chatbotRuleSchema.index({ tenantId: 1, isActive: 1, priority: -1 });

const WhatsappMessage = mongoose.model('WhatsappMessage', whatsappMessageSchema);
const Template = mongoose.model('Template', templateSchema);
const ChatbotRule = mongoose.model('ChatbotRule', chatbotRuleSchema);

module.exports = { WhatsappMessage, Template, ChatbotRule };
