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
                type: { type: String, enum: ['text', 'email', 'phone', 'number', 'textarea', 'dropdown', 'checkbox', 'date', 'file'], default: 'text' },
                placeholder: { type: String, default: '' },
                required: { type: Boolean, default: false },
                options: [String],
                order: { type: Number, default: 0 },
            },
        ],
        settings: {
            submitButtonText: { type: String, default: 'Submit' },
            successMessage: { type: String, default: 'Thank you! We will get back to you soon.' },
            redirectUrl: { type: String, default: '' },
            notifyEmails: [String],
            assignTo: { type: mongoose.Schema.Types.ObjectId, default: null },
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
    },
    { timestamps: true }
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
    },
    { timestamps: true }
);

const SmartForm = mongoose.model('SmartForm', smartFormSchema);
const FormSubmission = mongoose.model('FormSubmission', formSubmissionSchema);

module.exports = { SmartForm, FormSubmission };
