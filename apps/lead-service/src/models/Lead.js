const mongoose = require('mongoose');
const {
    LEAD_SOURCES,
    PIPELINE_STAGES,
    LEAD_PRIORITY,
} = require('@sparkcrm/shared-utils');

const leadSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            default: null,
            index: true,
        },

        // ─── Contact Info ───
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
        },
        lastName: {
            type: String,
            trim: true,
            default: '',
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
            default: '',
        },
        emailNormalized: {
            type: String,
            lowercase: true,
            trim: true,
            default: '',
            index: true,
        },
        phone: {
            type: String,
            trim: true,
            default: '',
        },
        phoneNormalized: {
            type: String,
            trim: true,
            default: '',
            index: true,
        },
        alternatePhone: {
            type: String,
            trim: true,
            default: '',
        },
        company: {
            type: String,
            trim: true,
            default: '',
        },
        designation: {
            type: String,
            trim: true,
            default: '',
        },

        // ─── Pipeline ───
        stage: {
            type: String,
            default: PIPELINE_STAGES.NEW,
        },
        previousStage: {
            type: String,
            default: null,
        },
        stageChangedAt: {
            type: Date,
            default: Date.now,
        },

        // ─── Source & Assignment ───
        source: {
            type: String,
            enum: Object.values(LEAD_SOURCES),
            default: LEAD_SOURCES.MANUAL,
        },
        sourceDetails: {
            type: String,
            default: '',
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        assignedAt: {
            type: Date,
            default: null,
        },
        origin: {
            provider: { type: String, default: '' },
            sourceId: { type: String, default: '' },
            sourceName: { type: String, default: '' },
            rawSource: { type: String, default: '' },
        },
        firstTouch: {
            campaignId: { type: String, default: '' },
            campaignName: { type: String, default: '' },
            adSetId: { type: String, default: '' },
            adSetName: { type: String, default: '' },
            adId: { type: String, default: '' },
            adName: { type: String, default: '' },
            formId: { type: String, default: '' },
            formName: { type: String, default: '' },
            capturedAt: { type: Date, default: null },
        },
        lastTouch: {
            campaignId: { type: String, default: '' },
            campaignName: { type: String, default: '' },
            adSetId: { type: String, default: '' },
            adSetName: { type: String, default: '' },
            adId: { type: String, default: '' },
            adName: { type: String, default: '' },
            formId: { type: String, default: '' },
            formName: { type: String, default: '' },
            capturedAt: { type: Date, default: null },
        },
        consent: {
            whatsappOptIn: { type: Boolean, default: false },
            whatsappOptInAt: { type: Date, default: null },
            marketingOptIn: { type: Boolean, default: false },
            source: { type: String, default: '' },
        },
        externalIdentities: [
            {
                provider: { type: String, required: true },
                externalId: { type: String, required: true },
                metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
            },
        ],

        // ─── Scoring ───
        score: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        scoreBreakdown: {
            profileCompleteness: { type: Number, default: 0 },
            engagement: { type: Number, default: 0 },
            responseRate: { type: Number, default: 0 },
            dealValue: { type: Number, default: 0 },
            recency: { type: Number, default: 0 },
        },
        lastScoredAt: {
            type: Date,
            default: null,
        },

        // ─── Deal ───
        priority: {
            type: String,
            enum: Object.values(LEAD_PRIORITY),
            default: LEAD_PRIORITY.MEDIUM,
        },
        expectedValue: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            default: 'INR',
        },

        // ─── Activity ───
        tags: [{ type: String, trim: true }],
        notes: [
            {
                text: { type: String, required: true },
                createdBy: { type: mongoose.Schema.Types.ObjectId },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        lastActivityAt: {
            type: Date,
            default: Date.now,
        },
        lastContactedAt: {
            type: Date,
            default: null,
        },
        followUpAt: {
            type: Date,
            default: null,
        },

        // ─── Custom Fields ───
        customFields: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
        },

        // ─── Location ───
        address: {
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            country: { type: String, default: 'India' },
            pincode: { type: String, default: '' },
        },

        // ─── Meta ───
        isArchived: {
            type: Boolean,
            default: false,
        },
        convertedAt: {
            type: Date,
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
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false
    }
);

// ─── Indexes for performance ───
leadSchema.index({ tenantId: 1, stage: 1 });
leadSchema.index({ tenantId: 1, assignedTo: 1 });
leadSchema.index({ tenantId: 1, source: 1 });
leadSchema.index({ tenantId: 1, score: -1 });
leadSchema.index({ tenantId: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, followUpAt: 1 });
leadSchema.index({ tenantId: 1, tags: 1 });
leadSchema.index({ tenantId: 1, email: 1 });
leadSchema.index({ tenantId: 1, phone: 1 });
leadSchema.index({ tenantId: 1, emailNormalized: 1 });
leadSchema.index({ tenantId: 1, phoneNormalized: 1 });
leadSchema.index({ tenantId: 1, 'externalIdentities.provider': 1, 'externalIdentities.externalId': 1 });

// ─── Full name virtual ───
leadSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`.trim();
});

leadSchema.set('toJSON', { virtuals: true });
leadSchema.set('toObject', { virtuals: true });

const Lead = mongoose.model('Lead', leadSchema);
module.exports = Lead;
