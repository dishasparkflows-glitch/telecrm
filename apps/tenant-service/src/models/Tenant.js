const mongoose = require('mongoose');
const { TENANT_STATUS, TRIAL_STATUS } = require('@sparkcrm/shared-utils');

const tenantSchema = new mongoose.Schema(
    {
        companyName: {
            type: String,
            required: [true, 'Company name is required'],
            trim: true,
            maxlength: [200, 'Company name cannot exceed 200 characters'],
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
            default: '',
        },
        logo: {
            type: String,
            default: '',
        },
        website: {
            type: String,
            default: '',
        },
        address: {
            type: String,
            trim: true,
        },

        // ─── Plan & Subscription ───
        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Plan',
            required: true,
        },
        planExpiresAt: {
            type: Date,
            default: null,
        },
        billingCycle: {
            type: String,
            enum: ['monthly', 'yearly', 'none'],
            default: 'none',
        },
        paymentMethodsConfigured: {
            type: Boolean,
            default: false,
        },
        paymentMethods: {
            type: [
                {
                    type: {
                        type: String,
                        enum: ['card', 'international_card', 'google_pay_qr'],
                        required: true,
                    },
                    provider: {
                        type: String,
                        enum: ['razorpay', 'stripe'],
                        required: true,
                    },
                    enabled: {
                        type: Boolean,
                        default: true,
                    },
                },
            ],
            default: [],
        },

        // ─── Trial ───
        trialStatus: {
            type: String,
            enum: Object.values(TRIAL_STATUS),
            default: TRIAL_STATUS.ACTIVE,
        },
        trialStartedAt: {
            type: Date,
            default: null,
        },
        trialExpiresAt: {
            type: Date,
            default: null,
        },
        trialConvertedAt: {
            type: Date,
            default: null,
        },

        // ─── Features ───
        // Stores feature slugs (e.g. 'call_recording', 'auto_dialer') as plain strings.
        // Previously stored ObjectId refs but the Feature model lives in billing-service
        // (separate DB), so cross-service Mongoose population is not possible.
        purchasedFeatures: [
            {
                type: String,
                trim: true,
                lowercase: true,
            },
        ],
        extraFeatures: [
            {
                type: String,
                trim: true,
            },
        ],
        extraModuleKeys: [
            {
                type: String,
                trim: true,
                lowercase: true,
            },
        ],

        // ─── Status ───
        status: {
            type: String,
            enum: Object.values(TENANT_STATUS),
            default: TENANT_STATUS.TRIAL,
        },
        suspendedReason: {
            type: String,
            default: null,
        },

        // ─── Calling Configuration ───
        // Assigned by the Owner from their Exotel virtual-number pool.
        // Individual agents do NOT configure Exotel — they only store their
        // personal mobile number (in User.mobileNumber) so Exotel knows which
        // phone to ring first when they click "Call".
        calling: {
            // The Exotel virtual number shown to leads (e.g. "08068XXXXXX")
            exotelVirtualNumber: { type: String, default: null, trim: true },
            // Owner can disable calling for a specific tenant without touching global config
            callingEnabled: { type: Boolean, default: false },
        },

        // ─── Settings ───
        settings: {
            timezone: { type: String, default: 'Asia/Kolkata' },
            workingHours: {
                start: { type: String, default: '09:00' },
                end: { type: String, default: '18:00' },
            },
            currency: { type: String, default: 'INR' },
            dateFormat: { type: String, default: 'DD/MM/YYYY' },
            language: { type: String, default: 'en' },
        },

        // ─── Pipeline (default stages) ───
        pipelineStages: {
            type: [
                {
                    name: { type: String, required: true },
                    slug: { type: String, required: true },
                    color: { type: String, default: '#6366f1' },
                    order: { type: Number, default: 0 },
                },
            ],
            default: [
                { name: 'New', slug: 'new', color: '#3b82f6', order: 0 },
                { name: 'Contacted', slug: 'contacted', color: '#8b5cf6', order: 1 },
                { name: 'Qualified', slug: 'qualified', color: '#f59e0b', order: 2 },
                { name: 'Follow-up', slug: 'follow_up', color: '#06b6d4', order: 3 },
                { name: 'Negotiation', slug: 'negotiation', color: '#f97316', order: 4 },
                { name: 'Won', slug: 'won', color: '#22c55e', order: 5 },
                { name: 'Lost', slug: 'lost', color: '#ef4444', order: 6 },
            ],
        },

        // ─── Custom Fields Definition ───
        customFields: [
            {
                name: { type: String, required: true },
                type: {
                    type: String,
                    enum: ['text', 'number', 'email', 'phone', 'date', 'dropdown', 'checkbox', 'textarea'],
                    default: 'text',
                },
                options: [String], // For dropdown type
                required: { type: Boolean, default: false },
                order: { type: Number, default: 0 },
            },
        ],

        // ─── Onboarding ───
        onboarding: {
            completedSteps: { type: [String], default: [] },
            isComplete: { type: Boolean, default: false },
        },

        // ─── Referral ───
        referralCode: {
            type: String,
            unique: true,
            sparse: true,
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            default: null,
        },
    },
    {
        timestamps: true, versionKey: false
    }
);

// ─── Indexes ───
tenantSchema.index({ slug: 1 });
tenantSchema.index({ email: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ trialStatus: 1, trialExpiresAt: 1 });
tenantSchema.index({ referralCode: 1 });

// ─── Virtual: isTrialActive ───
tenantSchema.virtual('isTrialActive').get(function () {
    return (
        this.trialStatus === TRIAL_STATUS.ACTIVE &&
        this.trialExpiresAt &&
        new Date() < new Date(this.trialExpiresAt)
    );
});

// ─── Virtual: trialDaysRemaining ───
tenantSchema.virtual('trialDaysRemaining').get(function () {
    if (!this.isTrialActive) return 0;
    const diff = new Date(this.trialExpiresAt) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

tenantSchema.set('toJSON', { virtuals: true });
tenantSchema.set('toObject', { virtuals: true });

const Tenant = mongoose.model('Tenant', tenantSchema);
module.exports = Tenant;
