const User = require('../models/User');
const { ApiResponse, ApiError, asyncHandler, ROLES, buildScopeFilter, getPresignedDownloadUrl, deleteMedia } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const crypto = require('crypto');
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
    const { name, email, phone, roleId, branchId, password } = req.body;

    if (!name || !email) throw ApiError.badRequest('Name and email are required');

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
        email: email.toLowerCase(),
    });
    if (existingUser) throw ApiError.conflict('User with this email already exists in this team');

    // Generate a temporary password if not provided
    const tempPassword = password || crypto.randomBytes(8).toString('hex');

    const user = await User.create({
        tenantId,
        name,
        email: email.toLowerCase(),
        phone: phone || '',
        password: tempPassword,
        roleId: roleId || null,
        branchId: branchId || null,
        invitedBy: invitedByUserId,
        inviteAccepted: false,
    });

    // Send invite email
    await publishEvent(EVENTS.SEND_EMAIL, {
        to: user.email,
        template: 'user_invite',
        data: {
            name: user.name,
            tempPassword,
            loginLink: `${process.env.DASHBOARD_URL || 'http://localhost:5174'}/login`,
        },
    });

    ApiResponse.created(res, user.toJSON(), 'User invited successfully');
});

/**
 * GET /api/users
 * Get all users in current tenant
 */
const getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, roleId, isActive } = req.query;

    // Build scope filter — superadmin sees all, managers see branch users
    const filter = buildScopeFilter(req, { ownerField: null, module: 'users' });
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }
    if (roleId) filter.roleId = roleId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
        User.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(parseInt(limit)),
        User.countDocuments(filter),
    ]);

    const usersWithUrls = await Promise.all(
        users.map(async (u) => {
            const userObj = u.toJSON();
            if (userObj.avatar) {
                userObj.avatar = await getPresignedDownloadUrl(userObj.avatar);
            }
            return userObj;
        })
    );

    ApiResponse.paginated(res, usersWithUrls, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    });
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
    userObj.avatar = await getPresignedDownloadUrl(userObj.avatar);
    ApiResponse.success(res, userObj);
});

/**
 * PUT /api/users/:id
 * Update a user
 */
const updateUser = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { name, phone, roleId, isActive, branchId, password, avatar } = req.body;

    const user = await User.findOne({ _id: req.params.id, tenantId });
    if (!user) throw ApiError.notFound('User not found');

    const callerRole = req.headers['x-user-role'];
    
    await Promise.all([
        validateRoleAssignment({ tenantId, roleId, callerRole }),
        validateBranchAssignment({ tenantId, branchId }),
    ]);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (roleId) user.roleId = roleId;
    if (branchId !== undefined) user.branchId = branchId;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;
    if (avatar && avatar !== user.avatar) {
        if (user.avatar) {
            await deleteMedia(user.avatar)
        }
        user.avatar = avatar;
    }

    await user.save();
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
    if (!isActive) user.refreshToken = null;
    await user.save();

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
    user.refreshToken = null;
    await user.save();

    ApiResponse.success(res, null, 'User deactivated');
});

module.exports = {
    inviteUser,
    getUsers,
    getUserById,
    updateUser,
    updateUserRole,
    updateUserStatus,
    deleteUser,
};

