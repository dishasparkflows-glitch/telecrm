const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('@sparkcrm/shared-utils');

const userSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Tenant ID is required'],
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
            default: '',
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false,
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.AGENT,
        },
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        avatar: {
            type: String,
            default: '',
        },

        // ─── Security ───
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: {
            type: String,
            select: false,
        },
        passwordResetToken: {
            type: String,
            select: false,
        },
        passwordResetExpires: {
            type: Date,
            select: false,
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        twoFactorSecret: {
            type: String,
            select: false,
        },
        loginAttempts: {
            type: Number,
            default: 0,
        },
        lockUntil: {
            type: Date,
            default: null,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        lastLoginIp: {
            type: String,
            default: '',
        },

        // ─── Status ───
        isActive: {
            type: Boolean,
            default: true,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        inviteAccepted: {
            type: Boolean,
            default: true,
        },

        // ─── Communication ───
        whatsappNumber: {
            type: String,
            trim: true,
            default: '',
        },
        // Agent's personal mobile number — Exotel rings this first when they click "Call".
        // The lead always sees the company's virtual number; this stays private.
        mobileNumber: {
            type: String,
            trim: true,
            default: '',
        },
        extensionNumber: {
            type: String,
            trim: true,
            default: '',
        },

        // ─── Refresh Token ───
        refreshToken: {
            type: String,
            select: false,
        },

        // ─── Custom Fields ───
        customFields: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true, versionKey: false
    }
);

// ─── Indexes ───
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, isActive: 1 });

// ─── Pre-save: Hash password ───
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// ─── Methods ───
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function () {
    return this.lockUntil && this.lockUntil > new Date();
};

userSchema.methods.incrementLoginAttempts = async function () {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
        this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }
    await this.save();
};

userSchema.methods.resetLoginAttempts = async function () {
    this.loginAttempts = 0;
    this.lockUntil = null;
    this.lastLoginAt = new Date();
    await this.save();
};

// ─── Remove sensitive fields from JSON ───
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.refreshToken;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    delete obj.twoFactorSecret;
    return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
