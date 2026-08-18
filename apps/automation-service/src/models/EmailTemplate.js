const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: '' },
        module: { type: String, required: true, index: true }, // e.g., 'Lead', 'Contact'
        category: { type: String, default: 'General' },
        subject: { type: String, required: true },
        bodyHtml: { type: String, default: '' },
        bodyText: { type: String, default: '' },
        status: { type: String, enum: ['draft', 'active', 'inactive'], default: 'draft', index: true },
        variables: [
            {
                key: { type: String, required: true },
                label: { type: String, required: true },
                module: { type: String, required: true }
            }
        ],
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now }
        }
    },
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, 
        versionKey: false,
        collection: 'email_templates'
    }
);

emailTemplateSchema.index({ tenantId: 1, name: 1 });

const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);

module.exports = EmailTemplate;
