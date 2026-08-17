const mongoose = require('mongoose');

const smartFormSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        fields: [
            {
                label: { type: String, required: true },
                name: { type: String, required: true },
                type: { type: String, enum: ['text', 'email', 'phone', 'number', 'textarea', 'dropdown', 'radio', 'checkbox', 'multiselect', 'date', 'datetime', 'file', 'currency'], default: 'text' },
                crmField: { type: String, default: '' },
                placeholder: { type: String, default: '' },
                helpText: { type: String, default: '' },
                defaultValue: { type: String, default: '' },
                required: { type: Boolean, default: false },
                options: [String],
                validationRules: { type: mongoose.Schema.Types.Mixed, default: {} },
                showIf: {
                    field: { type: String },
                    operator: { type: String, enum: ['equals', 'not_equals', 'contains'], default: 'equals' },
                    value: { type: String }
                },
                order: { type: Number, default: 0 },
            },
        ],
        settings: {
            submitButtonText: { type: String, default: 'Submit' },
            successMessage: { type: String, default: 'Thank you! We will get back to you soon.' },
            afterSubmitAction: { type: String, enum: ['message', 'redirect', 'booking'], default: 'message' },
            redirectUrl: { type: String, default: '' },
            bookingLinkId: { type: mongoose.Schema.Types.ObjectId, default: null },
            notifyEmails: [String],
            createLead: { type: Boolean, default: true },
            leadStage: { type: String, default: 'new' },
            leadSource: { type: String, default: 'smart_form' },
            autoTag: [String],
        },
        styling: {
            theme: { type: String, enum: ['light', 'dark', 'minimal', 'branded'], default: 'light' },
            primaryColor: { type: String, default: '#6366f1' },
            fontFamily: { type: String, default: 'Inter' },
        },
        embedCode: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        submissionCount: { type: Number, default: 0 },
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
        collection: 'smart_forms'
    }
);

const formSubmissionSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
        formId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmartForm', required: true, index: true },
        data: { type: mongoose.Schema.Types.Mixed, required: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, default: null },
        ipAddress: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        utmSource: { type: String, default: '' },
        utmMedium: { type: String, default: '' },
        utmCampaign: { type: String, default: '' },
        utmTerm: { type: String, default: '' },
        utmContent: { type: String, default: '' },
    
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
        collection: 'form_submissions'
    }
);

const SmartForm = mongoose.model('SmartForm', smartFormSchema);
const FormSubmission = mongoose.model('FormSubmission', formSubmissionSchema);

module.exports = { SmartForm, FormSubmission };
