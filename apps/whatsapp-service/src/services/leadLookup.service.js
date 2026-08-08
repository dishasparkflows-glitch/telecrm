/**
 * leadLookup.service.js
 *
 * Opens a SEPARATE Mongoose connection to sparkcrm_leads so that the
 * whatsapp-service can resolve phone numbers → lead ObjectIds without
 * making HTTP calls to the lead-service.
 *
 * Usage:
 *   const { findLeadByPhone, findLeadById } = require('./leadLookup.service');
 *   const lead = await findLeadByPhone(tenantId, '9898765432');
 */

const mongoose = require('mongoose');
const { env }  = require('@sparkcrm/shared-config');

// ── Schema (read-only, minimal fields we need) ────────────────────────────────
const leadSchema = new mongoose.Schema(
    {
        tenantId: mongoose.Schema.Types.ObjectId,
        contact: {
            phone:    String,
            phoneNormalized: String,
            firstName: String,
            lastName:  String,
        },
        isActive: Boolean,
    },
    { strict: false }   // ignore extra fields; we don't own this schema
);

// ── Connection ────────────────────────────────────────────────────────────────
let _conn    = null;  // lazy singleton
let _Lead    = null;

async function _getModel() {
    if (_Lead) return _Lead;

    const uri = env.MONGO.LEAD;

    _conn = await mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: 5000,
    }).asPromise();

    _Lead = _conn.model('Lead', leadSchema);
    console.log('✅ [leadLookup] Connected to sparkcrm_leads');
    return _Lead;
}

// ── Build phone variants (to handle stored 10-digit vs 91-prefixed) ───────────
function phoneVariants(raw) {
    if (!raw) return [];
    const digits = String(raw).replace(/[^0-9]/g, '');
    const variants = new Set([digits]);
    if (digits.length === 10) variants.add(`91${digits}`);
    if (digits.length === 12 && digits.startsWith('91')) variants.add(digits.slice(2));
    if (digits.length === 11 && digits.startsWith('1'))  variants.add(digits.slice(1));  // US/CA
    return [...variants];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * findLeadByPhone(tenantId, phone)
 * Returns { _id, firstName, lastName, phone } or null.
 */
async function findLeadByPhone(tenantId, phone) {
    try {
        const Lead = await _getModel();
        const variants = phoneVariants(phone);
        if (!variants.length) return null;

        const rawLead = await Lead.findOne({
            tenantId: new mongoose.Types.ObjectId(String(tenantId)),
            isActive: { $ne: false },
            $or: [
                { 'contact.phone': { $in: variants } },
                { 'contact.phoneNormalized': { $in: variants } },
            ],
        }).select('_id contact.firstName contact.lastName contact.phone contact.phoneNormalized').lean();

        if (!rawLead) return null;
        return {
            _id: rawLead._id,
            firstName: rawLead.contact?.firstName,
            lastName: rawLead.contact?.lastName,
            phone: rawLead.contact?.phone,
            phoneNormalized: rawLead.contact?.phoneNormalized,
        };
    } catch (err) {
        console.error('[leadLookup] findLeadByPhone error:', err.message);
        return null;
    }
}

/**
 * findLeadById(tenantId, leadId)
 * Returns { _id, phone, firstName, lastName } or null.
 */
async function findLeadById(tenantId, leadId) {
    try {
        const Lead = await _getModel();
        const rawLead = await Lead.findOne({
            _id:      new mongoose.Types.ObjectId(String(leadId)),
            tenantId: new mongoose.Types.ObjectId(String(tenantId)),
        }).select('_id contact.firstName contact.lastName contact.phone').lean();

        if (!rawLead) return null;
        return {
            _id: rawLead._id,
            firstName: rawLead.contact?.firstName,
            lastName: rawLead.contact?.lastName,
            phone: rawLead.contact?.phone,
        };
    } catch (err) {
        console.error('[leadLookup] findLeadById error:', err.message);
        return null;
    }
}

/**
 * phoneVariants — exposed so callers can build $in arrays for queries
 */
module.exports = { findLeadByPhone, findLeadById, phoneVariants };
