const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Branch name is required'],
            trim: true,
        },
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        address: {
            street: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            country: { type: String, default: 'India' },
            pincode: { type: String, default: '' },
        },
        phone: { type: String, default: '' },
        email: { type: String, default: '' },
        isDefault: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },

        // ─── Custom Fields ───
        customFields: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
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
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

// Unique branch code per tenant
branchSchema.index({ tenantId: 1, code: 1 }, { unique: true });

// Ensure only one default branch per tenant
branchSchema.pre('save', async function (next) {
    if (this.isModified('isDefault') && this.isDefault) {
        await this.constructor.updateMany(
            { tenantId: this.tenantId, _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        );
    }
    next();
});

module.exports = mongoose.model('Branch', branchSchema);
