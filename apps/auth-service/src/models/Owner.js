const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Owner Model — System-level owner account.
 * There is exactly ONE owner in the entire system.
 * Owner is NOT a tenant user — they manage all tenants.
 */
const ownerSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 6,
            select: false,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            default: 'System Owner',
        },
        role: {
            type: String,
            default: 'owner',
            immutable: true,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        lastLoginIp: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true, versionKey: false
    }
);

/**
 * Compare password
 */
ownerSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Remove sensitive fields from JSON
 */
ownerSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const Owner = mongoose.model('Owner', ownerSchema);
module.exports = Owner;
