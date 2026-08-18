const User = require('../models/User');
const { ApiResponse, ApiError, asyncHandler, ROLES, buildScopeFilter, getPresignedDownloadUrl, cacheHelper } = require('@sparkcrm/shared-utils');
const { getRolesBulk, getBranchesBulk } = require('../services/serviceClients/tenant.client');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const crypto = require('crypto');
const { validateCustomFields } = require('../utils/customFieldValidator');
const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const tenantServiceHeaders = (method, path, identity = {}) => createServiceHeaders({
    issuer: 'auth-service',
    audience: 'tenant-service',
    method,
    path,
    identity,
});

const validateBranchAssignment = async ({ tenantId, branchId }) => {
    if (!branchId) return;

    try {
        const path = `/internal/branches/${encodeURIComponent(String(tenantId))}`;
        const response = await axios.get(`${env.SERVICES.TENANT}${path}`, {
            timeout: 3000,
            headers: tenantServiceHeaders('GET', path, { tenantId: String(tenantId) }),
        });
        const branches = response.data?.data || [];
        if (!branches.some((branch) => String(branch._id) === String(branchId))) {
            throw ApiError.forbidden('Branch does not belong to this tenant');
        }
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw ApiError.internal('Unable to validate branch assignment');
    }
};

const validateRoleAssignment = async ({ tenantId, roleId, callerRole }) => {
    if (!roleId) return;

    let assignedRole;
    try {
        const path = `/internal/roles/${encodeURIComponent(String(roleId))}`;
        const response = await axios.get(`${env.SERVICES.TENANT}${path}`, {
            timeout: 3000,
            headers: tenantServiceHeaders('GET', path, { tenantId: String(tenantId) }),
        });
        assignedRole = response.data?.data;
    } catch (error) {
        if (error.response?.status === 404) throw ApiError.badRequest('Role not found');
        throw ApiError.internal('Unable to validate role assignment');
    }

    if (!assignedRole || String(assignedRole.tenantId) !== String(tenantId)) {
        throw ApiError.forbidden('Role does not belong to this tenant');
    }
    
    if (assignedRole.slug === ROLES.SUPER_ADMIN && callerRole !== ROLES.SUPER_ADMIN) {
        throw ApiError.forbidden('Only a superadmin can assign the superadmin role');
    }
};

/**
 * POST /api/users/invite
 * Invite a new user to the tenant
 */
const inviteUser = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const invitedByUserId = req.headers['x-user-id'];
    const { contact, roleId, branchId, customFields } = req.body;

    if (!contact?.name || !contact?.email) throw ApiError.badRequest('Name and email are required');

    if (customFields) {
        await validateCustomFields(tenantId, 'User', customFields);
    }

    await Promise.all([
        validateRoleAssignment({
            tenantId,
            roleId,
            callerRole: req.headers['x-user-role'],
        }),
        validateBranchAssignment({ tenantId, branchId }),
    ]);

    // Check if user already exists in this tenant
    const existingUser = await User.findOne({
        tenantId,
        'contact.email': contact.email.toLowerCase(),
    });
    if (existingUser) throw ApiError.conflict('User with this email already exists in this team');

    // Generate a temporary password if not provided
    const tempPassword = contact.password || crypto.randomBytes(8).toString('hex');

    const user = await User.create({
        tenantId,
        contact: {
            name: contact.name ? String(contact.name).trim() : '',
            email: contact.email.toLowerCase(),
            password: tempPassword,
            phone: contact.phone || '',
            whatsappNumber: contact.whatsappNumber || '',
        },
        authentication: {
            isEmailVerified: true,
            lastLoginAt: null,
            lastLoginIp: '',
        },
        twoFactor: {
            enabled: false,
            backupCodes: [],
        },
        security: {
            loginAttempts: 0,
            lockUntil: null,
        },
        invitation: {
            invitedBy: invitedByUserId,
            accepted: false,
            acceptedAt: null,
        },
        roleId: roleId || null,
        branchId: branchId || null,
        customFields: customFields || {},
    });

    // Send invite email
    await publishEvent(EVENTS.SEND_EMAIL, {
        to: user.contact?.email,
        template: 'user_invite',
        data: {
            name: user.contact?.name || '',
            tempPassword,
            loginLink: `${process.env.DASHBOARD_URL || 'http://localhost:5174'}/login`,
        }
    });

    await cacheHelper.deleteByPattern(`users:${tenantId}:*`);
    ApiResponse.created(res, user, 'User invited successfully');
});

/**
 * GET /api/users
 * Get all users in current tenant
 */
const getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, roleId, isActive } = req.query;

    const filter = buildScopeFilter(req, { ownerField: null, module: 'users' });
    const tenantId = req.headers['x-tenant-id'];
    const cacheKey = cacheHelper.generateKey(`users:${tenantId}:list`, { ...req.query, scope: JSON.stringify(filter) });

    const data = await cacheHelper.getOrSet(cacheKey, 3600, async () => {
        if (search) {
            filter.$or = [
                { 'contact.name': { $regex: search, $options: 'i' } },
                { 'contact.email': { $regex: search, $options: 'i' } },
                { 'contact.phone': { $regex: search, $options: 'i' } },
            ];
        }
        if (roleId) filter.roleId = roleId;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [users, total] = await Promise.all([
            User.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(parseInt(limit)),
            User.countDocuments(filter),
        ]);

    const roleIds = [...new Set(users.map(u => u.roleId).filter(Boolean).map(String))];
    const branchIds = [...new Set(users.map(u => u.branchId).filter(Boolean).map(String))];

    const [roles, branches] = await Promise.all([
        getRolesBulk(tenantId, roleIds),
        getBranchesBulk(tenantId, branchIds),
    ]);

    const roleMap = new Map(roles.map(r => [String(r._id), r]));
    const branchMap = new Map(branches.map(b => [String(b._id), b]));

    const usersWithUrls = await Promise.all(
        users.map(async (u) => {
            const userObj = u.toJSON();
            userObj.roleId = roleMap.get(String(userObj.roleId)) || userObj.roleId;
            userObj.branchId = branchMap.get(String(userObj.branchId)) || userObj.branchId;
            if (userObj.profile?.avatar) {
                const avatar = userObj.profile?.avatar;
                const presigned = await getPresignedDownloadUrl(avatar);
                userObj.avatar = presigned;
                if (userObj.profile) userObj.profile.avatar = presigned;
            }
            return userObj;
        })
    );

    return {
        users: usersWithUrls,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
        }
    };
    });

    ApiResponse.paginated(res, data.users, data.pagination);
});

/**
 * GET /api/users/compact
 * Get all active users id and name for dropdowns
 */
const getAllUsersList = asyncHandler(async (req, res) => {
    const { branchId } = req.query;
    const filter = buildScopeFilter(req, { ownerField: null, module: 'users' });
    const tenantId = req.headers['x-tenant-id'];
    const cacheKey = cacheHelper.generateKey(`users:${tenantId}:compact`, { ...req.query, scope: JSON.stringify(filter) });

    const formattedUsers = await cacheHelper.getOrSet(cacheKey, 3600, async () => {
        filter.isActive = true;
        if (branchId) filter.branchId = branchId;

        const users = await User.find(filter).select('_id contact.name contact.email roleId branchId profile.avatar').sort({ 'contact.name': 1 });

    const tenantId = req.headers['x-tenant-id'];
    const roleIds = [...new Set(users.map(u => u.roleId).filter(Boolean).map(String))];
    const branchIds = [...new Set(users.map(u => u.branchId).filter(Boolean).map(String))];

    const [roles, branches] = await Promise.all([
        getRolesBulk(tenantId, roleIds),
        getBranchesBulk(tenantId, branchIds),
    ]);

    const roleMap = new Map(roles.map(r => [String(r._id), r]));
    const branchMap = new Map(branches.map(b => [String(b._id), b]));

    const formattedUsers = await Promise.all(users.map(async (u) => {
        const userObj = {
            _id: u._id,
            name: u.contact?.name || '',
            email: u.contact?.email || '',
            roleId: roleMap.get(String(u.roleId)) || u.roleId,
            branchId: branchMap.get(String(u.branchId)) || u.branchId
        };
        
        if (u.profile?.avatar) {
            userObj.avatar = await getPresignedDownloadUrl(u.profile.avatar);
        }
        
        return userObj;
        }));
        return formattedUsers;
    });

    ApiResponse.success(res, formattedUsers);
});

/**
 * GET /api/users/:id
 * Get a user by ID
 */
const getUserById = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw ApiError.notFound('User not found');
    const userObj = user.toJSON();
    if (userObj.profile?.avatar) {
        const avatar = userObj.profile?.avatar;
        const presigned = await getPresignedDownloadUrl(avatar);
        userObj.avatar = presigned;
        if (userObj.profile) userObj.profile.avatar = presigned;
    }
    ApiResponse.success(res, userObj);
});

/**
 * PUT /api/users/:id
 * Update a user
 */
const updateUser = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { contact, roleId, branchId, isActive, customFields } = req.body;

    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw ApiError.notFound('User not found');
    
    if (customFields) {
        await validateCustomFields(tenantId, 'User', customFields);
    }
    await Promise.all([
        validateRoleAssignment({ tenantId, roleId, callerRole: req.headers['x-user-role'] }),
        validateBranchAssignment({ tenantId, branchId }),
    ]);

    if (contact) {
        if (contact.email && contact.email.toLowerCase() !== user.contact?.email) {
            const exists = await User.findOne({ tenantId, 'contact.email': contact.email.toLowerCase(), _id: { $ne: user._id } });
            if (exists) throw ApiError.conflict('User with this email already exists in this team');
            contact.email = contact.email.toLowerCase();
        }
        if (!contact.password) delete contact.password;
        Object.assign(user.contact ||= {}, contact);
    }

    if (roleId !== undefined) user.roleId = roleId || null;
    if (branchId !== undefined) user.branchId = branchId || null;
    if (isActive !== undefined) user.isActive = isActive;
    if (customFields !== undefined) user.customFields = customFields;

    await user.save();
    await cacheHelper.deleteByPattern(`users:${tenantId}:*`);

    ApiResponse.success(res, user.toJSON(), 'User updated');
});

/**
 * PUT /api/users/:id/role
 * Assign a dynamic role to a user
 */
const updateUserRole = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { roleId } = req.body;

    if (!roleId) throw ApiError.badRequest('roleId is required');

    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw ApiError.notFound('User not found');

    const callerRole = req.headers['x-user-role'];

    await validateRoleAssignment({ tenantId, roleId, callerRole });

    user.roleId = roleId;
    await user.save();
    await cacheHelper.deleteByPattern(`users:${tenantId}:*`);

    ApiResponse.success(res, user.toJSON(), 'User role updated');
});

/**
 * PUT /api/users/:id/status
 * Activate or deactivate a user
 */
const updateUserStatus = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { isActive } = req.body;

    if (isActive === undefined) throw ApiError.badRequest('isActive is required');

    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw ApiError.notFound('User not found');

    user.isActive = isActive;
    if (!isActive) {
        if (!user.authentication) user.authentication = {};
        user.authentication.refreshToken = null;
    }
    await user.save();
    await cacheHelper.deleteByPattern(`users:${tenantId}:*`);

    ApiResponse.success(res, user.toJSON(), `User ${isActive ? 'activated' : 'deactivated'}`);
});

/**
 * DELETE /api/users/:id
 * Deactivate a user (soft delete)
 */
const deleteUser = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw ApiError.notFound('User not found');

    user.isActive = false;
    if (!user.authentication) user.authentication = {};
    user.authentication.refreshToken = null;
    await user.save();
    await cacheHelper.deleteByPattern(`users:${tenantId}:*`);

    ApiResponse.success(res, null, 'User deactivated');
});

module.exports = {
    inviteUser,
    getUsers,
    getAllUsersList,
    getUserById,
    updateUser,
    updateUserRole,
    updateUserStatus,
    deleteUser,
};

