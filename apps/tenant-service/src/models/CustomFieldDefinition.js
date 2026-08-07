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
            enum: ['text', 'number', 'dropdown', 'select', 'date', 'checkbox', 'textarea', 'email'],
            default: 'text'
        },
        options: [String], // for dropdown
        isRequired: { type: Boolean, default: false },
        placeholder: { type: String, default: '' },
        defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Ensure unique field names per entity within a tenant
customFieldDefinitionSchema.index({ tenantId: 1, entity: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomFieldDefinition', customFieldDefinitionSchema);
