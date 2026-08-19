const Role = require('../models/Role');
const Module = require('../models/Module');
const Branch = require('../models/Branch');

/**
 * Default modules that every tenant gets on creation.
 * key = identifier used in permissions, path = frontend route.
 */
const DEFAULT_MODULES = [
    // ─── MENU section ───
    { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', section: 'MENU', order: 0, isSystem: true, requiredFeature: null },
    { key: 'leads', label: 'Leads', icon: 'Users', path: '/leads', section: 'MENU', order: 1, isSystem: true, requiredFeature: 'lead_management' },
    { key: 'followups', label: 'Follow-ups', icon: 'CalendarDays', path: '/follow-ups', section: 'MENU', order: 1.5, isSystem: true, requiredFeature: 'lead_management' },
    { key: 'calls', label: 'Calls', icon: 'Phone', path: '/calls', section: 'MENU', order: 2, isSystem: true, requiredFeature: 'calling_basic' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', path: '/whatsapp', section: 'MENU', order: 3, isSystem: true, requiredFeature: 'whatsapp_session' },
    { key: 'whatsapp_inbox', label: 'Team Inbox', icon: 'MessageCircle', path: '/whatsapp/inbox', parentKey: 'whatsapp', section: 'MENU', order: 4, isSystem: true, requiredFeature: 'whatsapp_session' },
    { key: 'whatsapp_broadcasts', label: 'Broadcasts', icon: 'Megaphone', path: '/whatsapp/broadcasts', parentKey: 'whatsapp', section: 'MENU', order: 5, isSystem: true, requiredFeature: 'whatsapp_session' },
    { key: 'forms', label: 'Smart Forms', icon: 'FileText', path: '/forms', section: 'MENU', order: 6, isSystem: true, requiredFeature: 'smart_forms' },
    { key: 'meetings', label: 'Meetings', icon: 'Calendar', path: '/meetings', section: 'MENU', order: 7, isSystem: true, requiredFeature: 'meeting_scheduler' },
    { key: 'tasks', label: 'Tasks', icon: 'CheckSquare', path: '/tasks', section: 'MENU', order: 7.5, isSystem: true, requiredFeature: 'task_management' },
    { key: 'automations', label: 'Automations', icon: 'Zap', path: '/automations', section: 'MENU', order: 8, isSystem: true, requiredFeature: 'automation_basic' },
    { key: 'analytics', label: 'Analytics', icon: 'BarChart3', path: '/analytics', section: 'MENU', order: 9, isSystem: true, requiredFeature: 'analytics_basic' },

    // ─── ADMIN section (Super Admin only — always visible) ───
    { key: 'roles', label: 'Roles & Permissions', icon: 'Shield', path: '/admin/roles', section: 'ADMIN', order: 0, isSystem: true, requiredFeature: null },
    { key: 'users', label: 'Users', icon: 'UserCog', path: '/admin/users', section: 'ADMIN', order: 1, isSystem: true, requiredFeature: null },
    { key: 'modules', label: 'Modules', icon: 'LayoutList', path: '/admin/modules', section: 'ADMIN', order: 2, isSystem: true, requiredFeature: null },
    { key: 'branches', label: 'Branches', icon: 'Building2', path: '/admin/branches', section: 'ADMIN', order: 3, isSystem: true, requiredFeature: null },

    // ─── SETTINGS section (always visible) ───
    { key: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', section: 'SETTINGS', order: 0, isSystem: true, requiredFeature: null },
    { key: 'billing', label: 'Billing', icon: 'CreditCard', path: '/billing', section: 'SETTINGS', order: 1, isSystem: true, requiredFeature: null },
    { key: 'audit', label: 'Audit Logs', icon: 'ClipboardList', path: '/audit', section: 'SETTINGS', order: 2, isSystem: true, requiredFeature: null },
    { key: 'notifications', label: 'Notifications', icon: 'Bell', path: '/notifications', section: 'SETTINGS', order: 3, isSystem: true, requiredFeature: null },
];

/**
 * All possible actions for permissions
 */
const ALL_ACTIONS = { view: true, create: true, edit: true, delete: true, export: true, upload: true, import: true, isOwn: false, isBranch: false, isGlobal: true };
const VIEW_ONLY = { view: true, create: false, edit: false, delete: false, export: false, upload: false, import: false, isOwn: false, isBranch: false, isGlobal: true };
const NO_ACCESS = { view: false, create: false, edit: false, delete: false, export: false, upload: false, import: false, isOwn: true, isBranch: false, isGlobal: false };

// Agent-level: can do CRUD but only on own data
const AGENT_FULL = { view: true, create: true, edit: true, delete: false, export: false, upload: true, import: true, isOwn: true, isBranch: false, isGlobal: false };
const AGENT_VIEW = { view: true, create: false, edit: false, delete: false, export: false, upload: false, import: false, isOwn: true, isBranch: false, isGlobal: false };

/**
 * Get all module keys (excluding children like whatsapp_inbox)
 */
function getPermissionModuleKeys() {
    return DEFAULT_MODULES
        .filter((m) => !m.parentKey)
        .map((m) => m.key);
}

/**
 * Build default roles for a new tenant
 */
function getDefaultRoles(tenantId, createdBy) {
    const allModuleKeys = getPermissionModuleKeys();

    // Super Admin: full access to everything (isGlobal = true everywhere)
    const superAdminPerms = allModuleKeys.map((key) => ({
        moduleKey: key,
        actions: { ...ALL_ACTIONS },
    }));

    // Branch Manager: full access except role/module management (isBranch = true → sees all branch data)
    const branchManagerPerms = allModuleKeys.map((key) => ({
        moduleKey: key,
        actions: ['roles', 'modules'].includes(key)
            ? { view: true, create: false, edit: false, delete: false, export: false, upload: false, import: false, isOwn: false, isBranch: true, isGlobal: false }
            : ['billing'].includes(key)
                ? { ...NO_ACCESS }
                : { view: true, create: true, edit: true, delete: true, export: true, upload: true, import: true, isOwn: false, isBranch: true, isGlobal: false },
    }));

    // Sales Lead: full on leads/calls/meetings (isGlobal = true → sees all branch data)
    const salesLeadPerms = allModuleKeys.map((key) => {
        if (['leads', 'calls', 'meetings', 'tasks'].includes(key)) return { moduleKey: key, actions: { ...ALL_ACTIONS } };
        if (['dashboard', 'whatsapp', 'forms', 'analytics'].includes(key)) return { moduleKey: key, actions: { view: true, create: true, edit: true, delete: false, export: true, upload: false, isOwn: false, isGlobal: true } };
        return { moduleKey: key, actions: { ...NO_ACCESS } };
    });

    // Senior Agent: CRUD on leads/calls/whatsapp/meetings — own data only (isOwn = true, isGlobal = false)
    const seniorAgentPerms = allModuleKeys.map((key) => {
        if (['leads', 'calls', 'whatsapp', 'meetings', 'tasks'].includes(key)) return { moduleKey: key, actions: { ...AGENT_FULL } };
        if (['dashboard', 'forms', 'notifications'].includes(key)) return { moduleKey: key, actions: { ...AGENT_VIEW } };
        return { moduleKey: key, actions: { ...NO_ACCESS } };
    });

    // Junior Agent: basic access — own data only
    const juniorAgentPerms = allModuleKeys.map((key) => {
        if (['leads', 'calls', 'tasks'].includes(key)) return { moduleKey: key, actions: { ...AGENT_FULL } };
        if (['dashboard', 'whatsapp', 'forms', 'meetings', 'notifications'].includes(key)) return { moduleKey: key, actions: { ...AGENT_VIEW } };
        return { moduleKey: key, actions: { ...NO_ACCESS } };
    });

    // Support Agent: CRUD on calls/whatsapp (own data), view leads/meetings
    const supportAgentPerms = allModuleKeys.map((key) => {
        if (['calls', 'whatsapp'].includes(key)) return { moduleKey: key, actions: { view: true, create: true, edit: true, delete: false, export: false, upload: false, isOwn: true, isGlobal: false } };
        if (['leads', 'meetings', 'tasks', 'dashboard', 'notifications'].includes(key)) return { moduleKey: key, actions: { ...AGENT_VIEW } };
        return { moduleKey: key, actions: { ...NO_ACCESS } };
    });

    return [
        {
            tenantId, name: 'Super Admin', slug: 'super-admin',
            description: 'Full access to all modules and settings',
            isSystem: true, isDefault: false,
            permissions: superAdminPerms, createdBy,
        },
        {
            tenantId, name: 'Branch Manager', slug: 'branch-manager',
            description: 'Manages branch operations with full access except billing/roles',
            isSystem: true, isDefault: false,
            permissions: branchManagerPerms, createdBy,
        },
        {
            tenantId, name: 'Sales Lead', slug: 'sales-lead',
            description: 'Senior sales with team oversight and analytics access',
            isSystem: false, isDefault: false,
            permissions: salesLeadPerms, createdBy,
        },
        {
            tenantId, name: 'Senior Agent', slug: 'senior-agent',
            description: 'Experienced sales agent with CRUD on key modules',
            isSystem: false, isDefault: false,
            permissions: seniorAgentPerms, createdBy,
        },
        {
            tenantId, name: 'Junior Agent', slug: 'junior-agent',
            description: 'Entry-level sales agent with basic access',
            isSystem: true, isDefault: true,
            permissions: juniorAgentPerms, createdBy,
        },
        {
            tenantId, name: 'Support Agent', slug: 'support-agent',
            description: 'Customer support with access to calls and WhatsApp',
            isSystem: false, isDefault: false,
            permissions: supportAgentPerms, createdBy,
        },
    ];
}

/**
 * Default branches for every new tenant
 */
const DEFAULT_BRANCHES = [
    { name: 'Head Office', code: 'HO', isDefault: true, address: { city: 'Mumbai', state: 'Maharashtra', country: 'India' } },
    { name: 'Delhi Branch', code: 'DEL', isDefault: false, address: { city: 'New Delhi', state: 'Delhi', country: 'India' } },
    { name: 'Bangalore Branch', code: 'BLR', isDefault: false, address: { city: 'Bangalore', state: 'Karnataka', country: 'India' } },
    { name: 'Pune Branch', code: 'PUN', isDefault: false, address: { city: 'Pune', state: 'Maharashtra', country: 'India' } },
    { name: 'Hyderabad Branch', code: 'HYD', isDefault: false, address: { city: 'Hyderabad', state: 'Telangana', country: 'India' } },
    { name: 'Chennai Branch', code: 'CHN', isDefault: false, address: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' } },
];

/**
 * Seed default roles, modules, and branches for a new tenant.
 * Called from internal.controller when a tenant is created.
 *
 * @param {String} tenantId
 * @param {String|null} createdBy - userId of the super admin
 * @returns {{ roles: Array, modules: Array, superAdminRoleId: String, defaultBranchId: String }}
 */
async function seedTenantDefaults(tenantId, createdBy = null) {
    // 1. Seed modules
    const moduleDocs = DEFAULT_MODULES.map((m) => ({
        ...m,
        tenantId,
        createdBy,
    }));
    const modules = await Module.insertMany(moduleDocs, { ordered: false }).catch((err) => {
        // Ignore duplicate key errors (already seeded)
        if (err.code === 11000) return Module.find({ tenantId });
        throw err;
    });

    // 2. Seed roles (6 roles)
    const roleDefs = getDefaultRoles(tenantId, createdBy);
    const roles = [];
    for (const def of roleDefs) {
        const existing = await Role.findOne({ tenantId, slug: def.slug });
        if (existing) {
            roles.push(existing);
        } else {
            roles.push(await Role.create(def));
        }
    }

    // 3. Seed branches (6 branches)
    const branches = [];
    for (const brDef of DEFAULT_BRANCHES) {
        let branch = await Branch.findOne({ tenantId, code: brDef.code });
        if (!branch) {
            branch = await Branch.create({
                tenantId,
                name: brDef.name,
                code: brDef.code,
                isDefault: brDef.isDefault,
                address: brDef.address,
                createdBy,
            });
        }
        branches.push(branch);
    }

    const superAdminRole = roles.find((r) => r.slug === 'super-admin');
    const defaultBranch = branches.find((b) => b.isDefault) || branches[0];

    return {
        roles,
        modules: Array.isArray(modules) ? modules : moduleDocs,
        branches,
        superAdminRoleId: superAdminRole ? superAdminRole._id : null,
        defaultBranchId: defaultBranch._id,
    };
}

module.exports = {
    seedTenantDefaults,
    DEFAULT_MODULES,
    DEFAULT_BRANCHES,
    ALL_ACTIONS,
    VIEW_ONLY,
    NO_ACCESS,
    AGENT_FULL,
    AGENT_VIEW,
    getPermissionModuleKeys,
};
