const mongoose = require('mongoose');

const PROVIDERS = ['meta_lead_ads', 'facebook', 'instagram', 'website_api', 'google_ads', 'custom_api'];

const leadSourceConnectionSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        provider: { type: String, enum: PROVIDERS, required: true, index: true },
        label: { type: String, default: '', trim: true },
        externalAccountId: { type: String, default: '', trim: true, index: true },
        externalAccountName: { type: String, default: '', trim: true },
        accessToken: { type: String, default: '' },
        apiKeyHash: { type: String, default: '', select: false },
        apiKeyPrefix: { type: String, default: '' },
        defaultAssignedTo: { type: mongoose.Schema.Types.ObjectId, default: null },
        defaultSource: { type: String, default: 'api' },
        tokenExpiresAt: { type: Date, default: null },
        verifyToken: { type: String, default: '', select: false },
        isActive: { type: Boolean, default: true, index: true },
        health: {
            status: { type: String, enum: ['unknown', 'healthy', 'expiring', 'failed'], default: 'unknown' },
            message: { type: String, default: '' },
            checkedAt: { type: Date, default: null },
        },
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

const leadSourceMappingSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadSourceConnection', required: true, index: true },
        provider: { type: String, enum: PROVIDERS, required: true, index: true },
        externalPageId: { type: String, default: '', trim: true, index: true },
        externalPageName: { type: String, default: '', trim: true },
        externalFormId: { type: String, default: '', trim: true, index: true },
        externalFormName: { type: String, default: '', trim: true },
        source: { type: String, default: 'facebook' },
        defaultAssignedTo: { type: mongoose.Schema.Types.ObjectId, default: null },
        welcomeTemplateName: { type: String, default: '' },
        sendWelcomeMessage: { type: Boolean, default: false },
        requireWhatsappConsent: { type: Boolean, default: true },
        fieldMapping: {
            firstName: { type: String, default: 'first_name' },
            lastName: { type: String, default: 'last_name' },
            fullName: { type: String, default: 'full_name' },
            email: { type: String, default: 'email' },
            phone: { type: String, default: 'phone_number' },
            company: { type: String, default: 'company_name' },
            whatsappConsent: { type: String, default: 'whatsapp_opt_in' },
        },
        isActive: { type: Boolean, default: true, index: true },
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

const metaOAuthStateSchema = new mongoose.Schema(
    {
        stateHash: { type: String, required: true, unique: true, index: true },
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null },
        userId: { type: mongoose.Schema.Types.ObjectId, default: null },
        expiresAt: { type: Date, required: true, index: { expires: 0 } },
        usedAt: { type: Date, default: null },
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

const inboundLeadEventSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        provider: { type: String, enum: PROVIDERS, required: true, index: true },
        eventType: { type: String, default: 'lead', index: true },
        idempotencyKey: { type: String, required: true, unique: true, index: true },
        externalLeadId: { type: String, default: '', trim: true, index: true },
        externalPageId: { type: String, default: '', trim: true, index: true },
        externalFormId: { type: String, default: '', trim: true, index: true },
        mappingId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        status: {
            type: String,
            enum: ['received', 'processing', 'duplicate', 'unmapped', 'processed', 'failed'],
            default: 'received',
            index: true,
        },
        error: { type: String, default: '' },
        attempts: { type: Number, default: 0 },
        duplicateDeliveries: { type: Number, default: 0 },
        processingAt: { type: Date, default: null },
        rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
        normalizedPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
        processedAt: { type: Date, default: null },
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

leadSourceConnectionSchema.index({ tenantId: 1, provider: 1, externalAccountId: 1 });
leadSourceMappingSchema.index(
    { provider: 1, externalPageId: 1, externalFormId: 1 },
    {
        name: 'unique_active_meta_page_form',
        unique: true,
        partialFilterExpression: { provider: 'meta_lead_ads', isActive: true },
    },
);
leadSourceMappingSchema.index({ tenantId: 1, connectionId: 1, provider: 1, externalPageId: 1, externalFormId: 1 });
inboundLeadEventSchema.index({ provider: 1, externalLeadId: 1 });
inboundLeadEventSchema.index({ provider: 1, status: 1, processingAt: 1, createdAt: 1 });

const LeadSourceConnection = mongoose.model('LeadSourceConnection', leadSourceConnectionSchema);
const LeadSourceMapping = mongoose.model('LeadSourceMapping', leadSourceMappingSchema);
const InboundLeadEvent = mongoose.model('InboundLeadEvent', inboundLeadEventSchema);
const MetaOAuthState = mongoose.model('MetaOAuthState', metaOAuthStateSchema);

module.exports = {
    PROVIDERS,
    LeadSourceConnection,
    LeadSourceMapping,
    InboundLeadEvent,
    MetaOAuthState,
};
