const mongoose = require('mongoose');

const customFieldDefinitionSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        entity: {
            type: String,
            enum: ['Lead', 'User', 'Meeting', 'Branch', 'Role', 'Task'],
            required: true,
            index: true
        },
        label: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true }, // camelCase identifier
        type: {
            type: String,
            enum: ['text', 'textarea', 'number', 'email', 'phone', 'date', 'datetime', 'time', 'dropdown', 'multiselect', 'radio', 'checkbox', 'boolean', 'url'],
            default: 'text'
        },
        options: [{
            id: { type: String, required: true },
            label: { type: String, required: true, trim: true },
            value: { type: String, required: true, trim: true }
        }], // for dropdown, multiselect, radio
        isRequired: { type: Boolean, default: false },
        placeholder: { type: String, default: '' },
        helpText: { type: String, default: '' },
        defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
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
        collection: 'custom_field_definitions'
    }
);

// Ensure unique field names per entity within a tenant
customFieldDefinitionSchema.index({ tenantId: 1, entity: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomFieldDefinition', customFieldDefinitionSchema);
