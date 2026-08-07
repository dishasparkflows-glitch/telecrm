const mongoose = require('mongoose');
const { encrypt, decrypt } = require('@sparkcrm/shared-utils');

/**
 * TenantWhatsAppConfig — per-tenant WhatsApp connection configuration.
 *
 * Each tenant picks EXACTLY ONE mode:
 *   - meta_shared    → one business number, all agents send from it
 *   - meta_per_agent → multiple business numbers, one assigned per agent
 *   - qr             → each agent scans QR to connect their personal number
 *
 * Sensitive fields (accessToken, appSecret) are AES-256 encrypted at rest.
 */
const phonePoolEntrySchema = new mongoose.Schema({
    phoneNumberId:    { type: String, required: true },
    phoneDisplay:     { type: String, default: '' },      // e.g. "+91 98765 43210"
    assignedUserId:   { type: mongoose.Schema.Types.ObjectId, default: null },
    assignedUserName: { type: String, default: '' },      // display only cache
}, { _id: true });

const tenantWhatsAppConfigSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            unique: true,
            index: true,
        },

        // ── Mode ──────────────────────────────────────────────────────────
        mode: {
            type: String,
            enum: ['meta_shared', 'meta_per_agent', 'qr'],
            required: true,
        },

        // ── Meta API fields (meta_shared + meta_per_agent) ────────────────
        wabaId:      { type: String, default: '' },     // WhatsApp Business Account ID
        accessToken: { type: String, default: '' },     // ENCRYPTED — AES-256
        appId:       { type: String, default: '' },     // Meta App ID
        appSecret:   { type: String, default: '' },     // ENCRYPTED
        verifyToken: { type: String, default: '' },     // webhook verify token

        // ── meta_shared only ──────────────────────────────────────────────
        sharedPhoneNumberId: { type: String, default: '' },
        sharedPhoneDisplay:  { type: String, default: '' },  // e.g. "+91 22 1234 5678"

        // ── meta_per_agent only ───────────────────────────────────────────
        phonePool: { type: [phonePoolEntrySchema], default: [] },

        // ── Status ────────────────────────────────────────────────────────
        isActive:     { type: Boolean, default: false },
        configuredBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        testStatus:   { type: String, enum: ['untested', 'success', 'failed'], default: 'untested' },
        testMessage:  { type: String, default: '' },
        lastTestedAt: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false }
);

// ── Encrypt / Decrypt helpers ─────────────────────────────────────────────────

tenantWhatsAppConfigSchema.methods.getDecryptedAccessToken = function () {
    if (!this.accessToken) return '';
    try { return decrypt(this.accessToken); } catch { return this.accessToken; }
};

tenantWhatsAppConfigSchema.methods.getDecryptedAppSecret = function () {
    if (!this.appSecret) return '';
    try { return decrypt(this.appSecret); } catch { return this.appSecret; }
};

/**
 * Safely mask a credential value for display in API responses.
 * Shows first 4 and last 4 chars separated by ••••••.
 */
function maskCred(plain) {
    if (!plain || plain.length < 8) return plain ? '••••••' : '';
    return plain.slice(0, 4) + '••••••' + plain.slice(-4);
}

/**
 * Return a safe-for-frontend version of this config (no raw secrets).
 */
tenantWhatsAppConfigSchema.methods.toSafeObject = function () {
    const decToken  = this.getDecryptedAccessToken();
    const decSecret = this.getDecryptedAppSecret();
    return {
        _id:                 this._id,
        tenantId:            this.tenantId,
        mode:                this.mode,
        wabaId:              this.wabaId,
        accessToken:         maskCred(decToken),
        appId:               this.appId,
        appSecret:           maskCred(decSecret),
        verifyToken:         this.verifyToken,
        sharedPhoneNumberId: this.sharedPhoneNumberId,
        sharedPhoneDisplay:  this.sharedPhoneDisplay,
        phonePool:           this.phonePool,
        isActive:            this.isActive,
        testStatus:          this.testStatus,
        testMessage:         this.testMessage,
        lastTestedAt:        this.lastTestedAt,
        updatedAt:           this.updatedAt,
    };
};

module.exports = mongoose.model('TenantWhatsAppConfig', tenantWhatsAppConfigSchema);
module.exports.encrypt = encrypt;
