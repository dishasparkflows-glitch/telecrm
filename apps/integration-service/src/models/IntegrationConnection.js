const mongoose = require('mongoose');

const integrationConnectionSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        ownerType: {
            type: String,
            enum: ['TENANT', 'USER'],
            required: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'IntegrationAccount',
            required: true,
        },
        provider: {
            type: String,
            required: true,
        },
        integrationType: {
            type: String,
            required: true,
            // e.g., GOOGLE_CALENDAR, GOOGLE_SHEETS, META_LEAD_ADS
        },
        status: {
            type: String,
            enum: ['CONNECTED', 'ERROR', 'DISCONNECTED'],
            default: 'CONNECTED',
        },
        configuration: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        permissions: {
            read: { type: Boolean, default: true },
            write: { type: Boolean, default: true },
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
        },
    },
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' },
        versionKey: false,
        collection: 'integration_connections',
    }
);

integrationConnectionSchema.index({ tenantId: 1, provider: 1, integrationType: 1 });
integrationConnectionSchema.index({ accountId: 1 });

module.exports = mongoose.model('IntegrationConnection', integrationConnectionSchema);
