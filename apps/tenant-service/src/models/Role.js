const mongoose = require('mongoose');

/**
 * Permission actions for a module
 */
const permissionActionSchema = new mongoose.Schema(
    {
        view: { type: Boolean, default: false },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        export: { type: Boolean, default: false },
        upload: { type: Boolean, default: false },
        import: { type: Boolean, default: false },
        isOwn: { type: Boolean, default: true },      // true = user sees only their own data
        isBranch: { type: Boolean, default: false },  // true = user sees their branch data
        isGlobal: { type: Boolean, default: false },   // true = user sees all data in their branch
    },
    { _id: false }
);

/**
 * Module permission — ties a moduleKey to its CRUD actions
 */
const modulePermissionSchema = new mongoose.Schema(
    {
        moduleKey: {
            type: String,
            required: true,
            trim: true,
        },
        actions: {
            type: permissionActionSchema,
            default: () => ({}),
        },
    },
    { _id: false }
);

/**
 * Role Model — Per-tenant dynamic roles with module-level permissions
 */
const roleSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Tenant ID is required'],
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Role name is required'],
            trim: true,
            maxlength: [100, 'Role name cannot exceed 100 characters'],
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        isSystem: {
            type: Boolean,
            default: false,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        permissions: [modulePermissionSchema],
        isActive: {
            type: Boolean,
            default: true,
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
roleSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
roleSchema.index({ tenantId: 1, isDefault: 1 });
roleSchema.index({ tenantId: 1, isActive: 1 });

// Pre-save: auto-generate slug from name
roleSchema.pre('validate', function (next) {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

// Ensure only one default role per tenant
roleSchema.pre('save', async function (next) {
    if (this.isDefault && this.isModified('isDefault')) {
        await this.constructor.updateMany(
            { tenantId: this.tenantId, _id: { $ne: this._id }, isDefault: true },
            { isDefault: false }
        );
    }
    next();
});

/**
 * Check if role has a specific permission
 * @param {String} moduleKey - e.g. 'leads'
 * @param {String} action - e.g. 'create'
 * @returns {Boolean}
 */
roleSchema.methods.hasPermission = function (moduleKey, action) {
    const modulePerm = this.permissions.find((p) => p.moduleKey === moduleKey);
    if (!modulePerm) return false;
    return modulePerm.actions[action] === true;
};

/**
 * Get a flat map of all permissions: { leads: { view: true, create: false, isOwn: true, isGlobal: false, ... }, ... }
 */
roleSchema.methods.toPermissionMap = function () {
    const map = {};
    for (const perm of this.permissions) {
        map[perm.moduleKey] = {
            view: perm.actions.view || false,
            create: perm.actions.create || false,
            edit: perm.actions.edit || false,
            delete: perm.actions.delete || false,
            export: perm.actions.export || false,
            upload: perm.actions.upload || false,
            import: perm.actions.import || false,
            isOwn: perm.actions.isOwn !== false,       // default true
            isBranch: perm.actions.isBranch || false,  // default false
            isGlobal: perm.actions.isGlobal || false,   // default false
        };
    }
    return map;
};

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;
