const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Tenant ID is required'],
            index: true,
        },
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role',
            default: null,
            index: true,
        },
        branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        isBranchLeader: {
            type: Boolean,
            default: false,
        },
        tokenVersion: {
            type: Number,
            default: 0,
        },
        // ─── Contact ───
        contact: {
            name: {
                type: String,
                required: [true, 'Name is required'],
                trim: true,
                default: '',
                alias: 'name',
            },
            email: {
                type: String,
                required: [true, 'Email is required'],
                lowercase: true,
                trim: true,
                alias: 'email',
            },
            password: {
                type: String,
                required: [true, 'Password is required'],
                minlength: [8, 'Password must be at least 8 characters'],
                select: false,
                alias: 'password',
            },
            avatar: {
                type: String,
                default: '',
                alias: 'avatar',
            },
            phone: {
                type: String,
                trim: true,
                default: '',
                alias: 'phone',
            },
            whatsappNumber: {
                type: String,
                trim: true,
                default: '',
            },
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
        },
        // ─── Authentication ───
        authentication: {
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
            refreshToken: {
                type: String,
                select: false,
                alias: 'refreshToken',
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
        // ─── Two Factor Authentication ───
        twoFactor: {
            enabled: {
                type: Boolean,
                default: false,
            },
            secret: {
                type: String,
                select: false,
            },
            backupCodes: {
                type: [String],
                select: false,
                default: [],
            },
        },
        // ─── Account Security ───
        security: {
            loginAttempts: {
                type: Number,
                default: 0,
            },
            lockUntil: {
                type: Date,
                default: null,
            },
        },

        // ─── Invitation ───
        invitation: {
            invitedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                default: null,
            },
            accepted: {
                type: Boolean,
                default: true,
            },
            acceptedAt: {
                type: Date,
                default: null,
            },
        },

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
    {
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false
    }
);

// ─── Indexes ───
userSchema.index({ tenantId: 1, 'contact.email': 1 }, { unique: true });
userSchema.index({ tenantId: 1, roleId: 1 });
userSchema.index({ tenantId: 1, isActive: 1 });

// ─── Pre-save: Hash password ───
userSchema.pre('save', async function (next) {
    if (this.isModified('contact.password')) {
        const pass = this.contact?.password;
        if (pass && !pass.startsWith('$2a$') && !pass.startsWith('$2b$')) {
            const salt = await bcrypt.genSalt(12);
            const hashed = await bcrypt.hash(pass, salt);
            if (!this.contact) this.contact = {};
            this.contact.password = hashed;
        }
    }
    next();
});

// ─── Methods ───
userSchema.methods.comparePassword = async function (candidatePassword) {
    const hash = this.contact?.password;
    if (!hash) return false;
    return bcrypt.compare(candidatePassword, hash);
};

userSchema.methods.isLocked = function () {
    const lockUntil = this.security?.lockUntil || this.lockUntil;
    return lockUntil && lockUntil > new Date();
};

userSchema.methods.incrementLoginAttempts = async function () {
    if (!this.security) this.security = {};
    this.security.loginAttempts = (this.security.loginAttempts || 0) + 1;
    this.loginAttempts = this.security.loginAttempts;
    if (this.security.loginAttempts >= 5) {
        this.security.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
        this.lockUntil = this.security.lockUntil;
    }
    await this.save();
};

userSchema.methods.resetLoginAttempts = async function () {
    if (!this.security) this.security = {};
    if (!this.authentication) this.authentication = {};
    this.security.loginAttempts = 0;
    this.security.lockUntil = null;
    this.authentication.lastLoginAt = new Date();
    this.loginAttempts = 0;
    this.lockUntil = null;
    this.lastLoginAt = this.authentication.lastLoginAt;
    await this.save();
};

// ─── Remove sensitive fields from JSON ───
userSchema.methods.toJSON = function () {
    const obj = this.toObject({ virtuals: true, flattenMaps: true });
    obj.name = obj.name || this.contact?.name || '';
    obj.email = obj.email || this.contact?.email || '';
    obj.phone = obj.phone || this.contact?.phone || '';
    obj.avatar = obj.avatar || this.contact?.avatar || '';
    obj.lastLoginAt = obj.lastLoginAt || this.authentication?.lastLoginAt || null;

    if (obj.contact) {
        delete obj.contact.password;
    }
    if (obj.authentication) {
        delete obj.authentication.refreshToken;
        delete obj.authentication.emailVerificationToken;
        delete obj.authentication.passwordResetToken;
        delete obj.authentication.passwordResetExpires;
    }
    if (obj.twoFactor) {
        delete obj.twoFactor.secret;
        delete obj.twoFactor.backupCodes;
    }
    delete obj.password;
    delete obj.refreshToken;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    delete obj.twoFactorSecret;
    delete obj.twoFactorBackupCodes;
    return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
