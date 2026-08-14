const mongoose = require('mongoose');
const crypto = require('crypto');

const ENCRYPTION_VERSION = 'v2';
const IV_LENGTH = 12;

function encryptionKey() {
    const configuredKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!configuredKey || configuredKey.length < 32) {
        throw new Error('CREDENTIAL_ENCRYPTION_KEY must contain at least 32 characters');
    }
    return crypto.createHash('sha256').update(configuredKey, 'utf8').digest();
}

function encrypt(text) {
    if (text === null || text === undefined || text === '') return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [ENCRYPTION_VERSION, iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(text) {
    if (text === '') return '';
    if (typeof text !== 'string') throw new Error('Invalid encrypted credential');

    const [version, ivHex, tagHex, encryptedHex, ...extra] = text.split(':');
    if (version !== ENCRYPTION_VERSION || extra.length ||
        !/^[a-f\d]{24}$/i.test(ivHex || '') ||
        !/^[a-f\d]{32}$/i.test(tagHex || '') ||
        !/^(?:[a-f\d]{2})+$/i.test(encryptedHex || '')) {
        throw new Error('Invalid encrypted credential');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}

/**
 * Integration Credential Model
 * Stores encrypted API keys / tokens per tenant for various integrations
 */
const integrationCredentialSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        provider: {
            type: String,
            required: true,
            enum: [
                'exotel',       // Calling via Exotel
                'twilio',       // Calling via Twilio
                'whatsapp',     // WhatsApp Business API (Meta)
                'meta_lead_ads', // Facebook / Instagram Lead Ads
                'razorpay',     // Payment gateway
                'smtp',         // Email (SMTP)
                'aws_s3',       // File storage
                'google_meet',  // Meeting integration
                'zoom',         // Meeting integration
                'zapier',       // Webhook/integration
                'custom_api',   // Custom API
                'google_calendar', // User-level Google Calendar
            ],
        },
        label: {
            type: String,
            default: '',
            trim: true,
        },
        credentials: {
            type: Map,
            of: String, // All values stored encrypted
            default: {},
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastTestedAt: {
            type: Date,
            default: null,
        },
        lastTestStatus: {
            type: String,
            enum: ['success', 'failed', null],
            default: null,
        },
        configuredBy: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
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
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, 
        versionKey: false,
        collection: 'integration_credentials'
    }
);

integrationCredentialSchema.index({ tenantId: 1, userId: 1, provider: 1 }, { unique: true });

const IntegrationCredential = mongoose.model('IntegrationCredential', integrationCredentialSchema);

module.exports = { IntegrationCredential, encrypt, decrypt };
