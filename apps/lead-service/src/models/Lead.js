const mongoose = require('mongoose');
const {
    LEAD_SOURCES,
    PIPELINE_STAGES,
    LEAD_PRIORITY,
} = require('@sparkcrm/shared-utils');

const leadSchema = new mongoose.Schema(
    {
        leadNumber: {
            type: String,
            required: true,
            index: true,
        },
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
        contact: {
            firstName: {
                type: String,
                required: [true, 'First name is required'],
                trim: true,
            },
            lastName: {
                type: String,
                trim: true,
            },
            email: {
                type: String,
                lowercase: true,
                trim: true,
            },
            emailNormalized: {
                type: String,
                lowercase: true,
                trim: true,
                index: true,
            },
            countryCode: {
                type: String,
                trim: true,
                default: '+91',
            },
            phone: {
                type: String,
                trim: true,
            },
            phoneNormalized: {
                type: String,
                trim: true,
                index: true,
            },
            alternatePhone: {
                type: String,
                trim: true,
            },
            company: {
                type: String,
                trim: true,
            },
            designation: {
                type: String,
                trim: true,
            },
        },
        // ─── Pipeline ───
        pipeline: {
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
        },
        // ─── Source & Assignment ───
        source: {
            type: String,
            enum: Object.values(LEAD_SOURCES),
            default: LEAD_SOURCES.MANUAL,
        },
        sourceDetails: {
            type: String,
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
            provider: { type: String },
            sourceId: { type: String },
            sourceName: { type: String },
            rawSource: { type: String },
        },
        firstTouch: {
            campaignId: { type: String },
            campaignName: { type: String },
            adSetId: { type: String },
            adSetName: { type: String },
            adId: { type: String },
            adName: { type: String },
            formId: { type: String },
            formName: { type: String },
            capturedAt: { type: Date, default: null },
        },
        lastTouch: {
            campaignId: { type: String },
            campaignName: { type: String },
            adSetId: { type: String },
            adSetName: { type: String },
            adId: { type: String },
            adName: { type: String },
            formId: { type: String },
            formName: { type: String },
            capturedAt: { type: Date, default: null },
        },
        consent: {
            whatsappOptIn: { type: Boolean, default: false },
            whatsappOptInAt: { type: Date, default: null },
            marketingOptIn: { type: Boolean, default: false },
            source: { type: String },
        },
        externalIdentities: [
            {
                provider: { type: String, required: true },
                externalId: { type: String, required: true },
                metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
            },
        ],
        // ─── Scoring ───
        scoring: {
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
        },
        // ─── Lifecycle ───
        lifecycle: {
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
            lastActivityAt: {
                type: Date,
                default: null,
            },
            lastContactedAt: {
                type: Date,
                default: null,
            },
            followUpAt: {
                type: Date,
                default: null,
            },
            convertedAt: {
                type: Date,
                default: null,
            },
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

        // ─── Custom Fields ───
        customFields: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
        },

        // ─── Location ───
        address: {
            city: { type: String },
            state: { type: String },
            country: { type: String, default: 'India' },
            pincode: { type: String },
        },

        // ─── Meta ───
        isArchived: {
            type: Boolean,
            default: false,
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
leadSchema.index({ leadNumber: 1 }, { unique: true });
leadSchema.index({ tenantId: 1, 'pipeline.stage': 1 });
leadSchema.index({ tenantId: 1, assignedTo: 1 });
leadSchema.index({ tenantId: 1, source: 1 });
leadSchema.index({ tenantId: 1, 'scoring.score': -1 });
leadSchema.index({ tenantId: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, 'lifecycle.followUpAt': 1 });
leadSchema.index({ tenantId: 1, tags: 1 });
leadSchema.index({ tenantId: 1, 'contact.email': 1 });
leadSchema.index({ tenantId: 1, 'contact.phone': 1 });
leadSchema.index({ tenantId: 1, 'contact.emailNormalized': 1 });
leadSchema.index({ tenantId: 1, 'contact.phoneNormalized': 1 });
leadSchema.index({ tenantId: 1, 'externalIdentities.provider': 1, 'externalIdentities.externalId': 1 });

// ─── Full name virtual ───
leadSchema.virtual('fullName').get(function () {
    return `${this.contact?.firstName || ''} ${this.contact?.lastName || ''}`.trim();
});

leadSchema.set('toJSON', { virtuals: true, flattenMaps: true });
leadSchema.set('toObject', { virtuals: true, flattenMaps: true });

const Lead = mongoose.model('Lead', leadSchema);
module.exports = Lead;
