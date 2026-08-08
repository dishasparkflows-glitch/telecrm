const mongoose = require('mongoose');

/**
 * Module Model — Dynamic sidebar modules per tenant
 *
 * System modules (isSystem: true) are seeded on tenant creation and cannot be deleted.
 * Super admin can create custom modules, reorder, and toggle visibility.
 */
const moduleSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Tenant ID is required'],
            index: true,
        },
        key: {
            type: String,
            required: [true, 'Module key is required'],
            trim: true,
            lowercase: true,
        },
        label: {
            type: String,
            required: [true, 'Module label is required'],
            trim: true,
            maxlength: [100, 'Label cannot exceed 100 characters'],
        },
        icon: {
            type: String,
            trim: true,
            default: 'Box',
        },
        path: {
            type: String,
            required: [true, 'Module path is required'],
            trim: true,
        },
        parentKey: {
            type: String,
            default: null,
            trim: true,
        },
        section: {
            type: String,
            enum: ['MENU', 'SETTINGS', 'ADMIN'],
            default: 'MENU',
        },
        order: {
            type: Number,
            default: 0,
        },
        isSystem: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        requiredFeature: {
            type: String,
            default: null,
            trim: true,
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

// Compound indexes
moduleSchema.index({ tenantId: 1, key: 1 }, { unique: true });
moduleSchema.index({ tenantId: 1, section: 1, order: 1 });
moduleSchema.index({ tenantId: 1, parentKey: 1 });

const Module = mongoose.model('Module', moduleSchema);
module.exports = Module;
