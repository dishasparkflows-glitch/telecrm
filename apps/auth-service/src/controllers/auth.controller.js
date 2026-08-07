const User = require('../models/User');
const OTP = require('../models/OTP');
const { ApiResponse, ApiError, asyncHandler, ROLES, validateEmail, validatePhone } = require('@sparkcrm/shared-utils');
const { generateTokenPair, verifyRefreshToken, generateAccessToken, generateRefreshToken } = require('../services/jwt.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const tenantServiceHeaders = (method, path, identity = {}) => createServiceHeaders({
    issuer: 'auth-service',
    audience: 'tenant-service',
    method,
    path,
    identity,
});

// Fixed OTPs are allowed only outside production. Missing delivery
// configuration must never silently enable a universal production OTP.
const IS_DEV = process.env.NODE_ENV !== 'production';
const DEV_OTP = '123456';

/**
 * Fetch user's role permissions, tenant modules, branches, and features from tenant-service
 * Returns { permissions, modules, branches, features, plan, subscription } or defaults on failure
 */
async function fetchUserPermissions(user) {
    let permissions = {};
    let modules = [];
    let branches = [];
    let features = [];
    let plan = null;
    let subscription = null;

    try {
        // Fetch role permissions if user has roleId
        if (user.roleId) {
            const path = `/internal/roles/${encodeURIComponent(String(user.roleId))}`;
            const roleRes = await axios.get(`${env.SERVICES.TENANT}${path}`, {
                headers: tenantServiceHeaders('GET', path),
            });
            if (roleRes.data.success) {
                permissions = roleRes.data.data.permissions || {};
            }
        }

        // Fetch tenant modules (already plan-filtered by internal endpoint)
        if (user.tenantId) {
            const path = `/internal/modules/${encodeURIComponent(String(user.tenantId))}`;
            const modRes = await axios.get(`${env.SERVICES.TENANT}${path}`, {
                headers: tenantServiceHeaders('GET', path, { tenantId: String(user.tenantId) }),
            });
            if (modRes.data.success) {
                modules = modRes.data.data || [];
            }
        }

        // Fetch tenant branches
        if (user.tenantId) {
            const path = `/internal/branches/${encodeURIComponent(String(user.tenantId))}`;
            const branchRes = await axios.get(`${env.SERVICES.TENANT}${path}`, {
                headers: tenantServiceHeaders('GET', path, { tenantId: String(user.tenantId) }),
            });
            if (branchRes.data.success) {
                branches = branchRes.data.data || [];
            }
        }

        // Fetch tenant features, plan, and subscription info
        if (user.tenantId) {
            const path = `/internal/features/${encodeURIComponent(String(user.tenantId))}`;
            const featRes = await axios.get(`${env.SERVICES.TENANT}${path}`, {
                headers: tenantServiceHeaders('GET', path, { tenantId: String(user.tenantId) }),
            });
            if (featRes.data.success) {
                features = featRes.data.data.features || [];
                plan = featRes.data.data.plan || null;
                subscription = featRes.data.data.subscription || null;
            }
        }
    } catch (err) {
        console.error('⚠️ Failed to fetch permissions/modules/branches/features:', err.message);
    }

    return { permissions, modules, branches, features, plan, subscription };
}

/**
 * POST /api/auth/send-otp
 * Send OTP to email and phone for verification
 */
const sendOtp = asyncHandler(async (req, res) => {
    const { email, phone } = req.body;

    // Validate email
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) throw ApiError.badRequest(emailCheck.reason);

    // Validate phone
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) throw ApiError.badRequest(phoneCheck.reason);

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw ApiError.conflict('An account with this email already exists');
    }

    // Check rate limit — max 1 OTP per 60 seconds
    const recentOtp = await OTP.findOne({
        email: email.toLowerCase(),
        lastResendAt: { $gte: new Date(Date.now() - 60 * 1000) },
    });
    if (recentOtp) {
        throw ApiError.badRequest('Please wait 60 seconds before requesting a new OTP.');
    }

    // Generate OTPs (dev mode: fixed 123456)
    const emailOtp = IS_DEV ? DEV_OTP : String(Math.floor(100000 + Math.random() * 900000));
    const phoneOtp = IS_DEV ? DEV_OTP : String(Math.floor(100000 + Math.random() * 900000));

    // Remove any existing OTP for this email
    await OTP.deleteMany({ email: email.toLowerCase() });

    // Create new OTP record (expires in 10 minutes)
    await OTP.create({
        email: email.toLowerCase(),
        phone: phone.replace(/[\s-]/g, ''),
        emailOtp,
        phoneOtp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        lastResendAt: new Date(),
    });

    // Send OTP via email (in production)
    if (!IS_DEV) {
        try {
            await publishEvent(EVENTS.SEND_EMAIL, {
                to: email.toLowerCase(),
                template: 'otp',
                data: { otp: emailOtp, email },
            });
        } catch (err) {
            console.error('⚠️ Failed to send email OTP:', err.message);
        }
    }

    // Send OTP via SMS (in production)
    if (!IS_DEV) {
        // TODO: Integrate SMS gateway (MSG91, Twilio, etc.)
        console.warn('⚠️ SMS OTP delivery is not configured');
    } else {
        console.log(`🔐 [DEV] OTP for ${email}: Email=${emailOtp}, Phone=${phoneOtp}`);
    }

    ApiResponse.success(res, {
        email: email.toLowerCase(),
        phone: phone.replace(/[\s-]/g, ''),
        otpSent: true,
        expiresInSeconds: 600,
        ...(IS_DEV ? { devOtp: DEV_OTP } : {}),
    }, 'OTP sent to your email and phone number.');
});

/**
 * POST /api/auth/verify-otp
 * Verify email and phone OTPs
 */
const verifyOtp = asyncHandler(async (req, res) => {
    const { email, phone, emailOtp, phoneOtp } = req.body;

    if (!email || !phone || !emailOtp || !phoneOtp) {
        throw ApiError.badRequest('Email, phone, email OTP, and phone OTP are required');
    }

    const normalizedPhone = phone.replace(/[\s-]/g, '');
    const otpRecord = await OTP.findOne({
        email: email.toLowerCase(),
        phone: normalizedPhone,
        expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
        throw ApiError.badRequest('OTP expired or not found. Please request a new OTP.');
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
        throw ApiError.badRequest('Too many incorrect attempts. Please request a new OTP.');
    }

    // Verify email OTP
    if (otpRecord.emailOtp !== emailOtp) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw ApiError.badRequest('Incorrect email OTP. Please try again.');
    }

    // Verify phone OTP
    if (otpRecord.phoneOtp !== phoneOtp) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw ApiError.badRequest('Incorrect phone OTP. Please try again.');
    }

    // Mark as verified
    otpRecord.emailVerified = true;
    otpRecord.phoneVerified = true;
    await otpRecord.save();

    ApiResponse.success(res, {
        email: email.toLowerCase(),
        verified: true,
    }, 'OTP verified successfully. You can now complete registration.');
});

/**
 * POST /api/auth/register-tenant
 * Register a new tenant + superadmin user + start 30-day trial
 * Requires OTP verification first
 */
const registerTenant = asyncHandler(async (req, res) => {
    const { name, email, phone, password, companyName, referralCode, planSlug } = req.body;

    if (!name || !email || !phone || !password || !companyName) {
        throw ApiError.badRequest('Name, email, phone, password, and company name are required');
    }

    // Validate email format
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) throw ApiError.badRequest(emailCheck.reason);

    // Validate phone format
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) throw ApiError.badRequest(phoneCheck.reason);

    // Verify OTP was completed
    const otpRecord = await OTP.findOne({
        email: email.toLowerCase(),
        phone: phone.replace(/[\s-]/g, ''),
        emailVerified: true,
        phoneVerified: true,
        expiresAt: { $gt: new Date() },
    });
    if (!otpRecord) {
        throw ApiError.badRequest('Please verify your email and phone OTP before registering.');
    }

    // Check if email already exists globally
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw ApiError.conflict('An account with this email already exists');
    }

    // Create tenant via tenant-service
    let tenantData;
    try {
        const path = '/internal/tenants';
        const response = await axios.post(`${env.SERVICES.TENANT}${path}`, {
            companyName,
            email: email.toLowerCase(),
            phone: phone.replace(/[\s-]/g, ''),
            referralCode: referralCode || null,
            planSlug: planSlug || null,
        }, {
            headers: tenantServiceHeaders('POST', path),
        });
        tenantData = response.data.data;
    } catch (error) {
        console.error('❌ Failed to create tenant:', error.message);
        throw ApiError.internal('Failed to create tenant. Please try again.');
    }

    // Create superadmin user with roleId and branchId from seeded data
    const user = await User.create({
        tenantId: tenantData._id,
        name,
        email: email.toLowerCase(),
        phone: phone.replace(/[\s-]/g, ''),
        password,
        role: 'superadmin',
        roleId: tenantData.superAdminRoleId || null,
        branchId: tenantData.defaultBranchId || null,
        isEmailVerified: true,
        inviteAccepted: true,
    });

    // Clean up OTP record
    await OTP.deleteMany({ email: email.toLowerCase() });

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Save refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Fetch permissions, modules, branches, and features
    const { permissions, modules, branches, features, plan, subscription } = await fetchUserPermissions(user);

    ApiResponse.created(res, {
        user: user.toJSON(),
        tenant: tenantData,
        tokens,
        permissions,
        modules,
        branches,
        features,
        plan,
        subscription,
    }, 'Registration successful! Your 30-day free trial has started.');
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw ApiError.badRequest('Email and password are required');
    }

    const user = await User.findOne({ email: email.toLowerCase() })
        .select('+password +refreshToken +lockUntil +loginAttempts');

    if (!user) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

    // Check account lockout
    if (user.isLocked()) {
        const lockMinutes = Math.ceil((user.lockUntil - new Date()) / (1000 * 60));
        throw ApiError.tooManyRequests(
            `Account locked due to too many failed attempts. Try again in ${lockMinutes} minutes.`
        );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw ApiError.unauthorized('Invalid email or password');
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate new token pair
    const tokens = generateTokenPair(user);
    user.refreshToken = tokens.refreshToken;
    user.lastLoginIp = req.ip || req.headers['x-forwarded-for'] || '';
    await user.save();

    // Fetch permissions, modules, branches, and features
    const { permissions, modules, branches, features, plan, subscription } = await fetchUserPermissions(user);

    ApiResponse.success(res, {
        user: user.toJSON(),
        tokens,
        permissions,
        modules,
        branches,
        features,
        plan,
        subscription,
    }, 'Login successful');
});

/**
 * POST /api/auth/refresh-token
 * Get a new access token using refresh token
 */
const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken: token } = req.body;
    if (!token) throw ApiError.badRequest('Refresh token is required');

    let decoded;
    try {
        decoded = verifyRefreshToken(token);
    } catch (_err) {
        throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
        throw ApiError.unauthorized('Invalid refresh token');
    }
    if (!user.isActive) {
        user.refreshToken = null;
        await user.save();
        throw ApiError.forbidden('Your account has been deactivated');
    }
    if (user.isLocked()) {
        throw ApiError.tooManyRequests('Your account is temporarily locked');
    }

    const tokens = generateTokenPair(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    ApiResponse.success(res, { tokens }, 'Token refreshed');
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) throw ApiError.badRequest('Email is required');

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        // Don't reveal if email exists
        return ApiResponse.success(res, null, 'If the email exists, a reset link has been sent');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Publish email event
    await publishEvent(EVENTS.SEND_EMAIL, {
        to: user.email,
        template: 'password_reset',
        data: {
            name: user.name,
            resetLink: `${env.DASHBOARD_URL}/reset-password/${resetToken}`,
        },
    });

    ApiResponse.success(res, null, 'If the email exists, a reset link has been sent');
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) throw ApiError.badRequest('Token and new password are required');

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) throw ApiError.badRequest('Invalid or expired reset token');

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = null;
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    ApiResponse.success(res, null, 'Password reset successful. Please login with your new password.');
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token
 */
const logout = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (userId) {
        await User.findByIdAndUpdate(userId, { refreshToken: null });
    }
    ApiResponse.success(res, null, 'Logged out successfully');
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
const getMe = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) throw ApiError.unauthorized('Not authenticated');

    // Prevent HTTP 304 caching — response varies by auth context
    res.set('Cache-Control', 'no-store');

    // Handle impersonation — owner's userId won't exist in User collection
    const token = req.headers.authorization?.split(' ')[1];
    let decoded = {};
    try { decoded = jwt.verify(token, env.JWT_SECRET); } catch { }

    if (decoded.isImpersonating) {
        // Build a synthetic user for the impersonating owner
        const syntheticUser = {
            _id: userId,
            name: 'Owner (Impersonating)',
            email: decoded.email || 'owner@sparkcrm.com',
            role: decoded.role || 'superadmin',
            tenantId: decoded.tenantId,
            branchId: decoded.branchId || '',
            isActive: true,
            isImpersonating: true,
        };

        // Fetch tenant's modules, branches, and features
        const { permissions, modules, branches, features, plan, subscription } = await fetchUserPermissions({
            tenantId: decoded.tenantId,
            roleId: null,
        });

        return ApiResponse.success(res, {
            user: syntheticUser,
            permissions,
            modules,
            branches,
            features,
            plan,
            subscription,
        }, 'Profile fetched (impersonation)');
    }

    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    // Fetch permissions, modules, branches, and features (same as login)
    const { permissions, modules, branches, features, plan, subscription } = await fetchUserPermissions(user);

    ApiResponse.success(res, {
        user: user.toJSON(),
        permissions,
        modules,
        branches,
        features,
        plan,
        subscription,
    }, 'Profile fetched');
});

/**
 * PUT /api/auth/active-branch
 * Update current user's active branch
 */
const switchBranch = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { branchId } = req.body;

    if (!branchId) throw ApiError.badRequest('Branch ID is required');

    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    let branches;
    try {
        const path = `/internal/branches/${encodeURIComponent(String(user.tenantId))}`;
        const response = await axios.get(`${env.SERVICES.TENANT}${path}`, {
            timeout: 3000,
            headers: tenantServiceHeaders('GET', path, { tenantId: String(user.tenantId) }),
        });
        branches = response.data?.data || [];
    } catch {
        throw ApiError.internal('Unable to validate branch selection');
    }
    if (!branches.some((branch) => String(branch._id) === String(branchId))) {
        throw ApiError.forbidden('Branch does not belong to this tenant');
    }

    user.branchId = branchId;
    await user.save();

    ApiResponse.success(res, { branchId }, 'Active branch updated');
});

/**
 * POST /api/auth/owner-login
 * Owner-only login — validates against Owner model (not User).
 * Owner JWT has no tenantId or branchId — they are above tenants.
 */
const Owner = require('../models/Owner');

const ownerLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw ApiError.badRequest('Email and password are required');
    }

    const owner = await Owner.findOne({ email: email.toLowerCase() }).select('+password');
    if (!owner) {
        throw ApiError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await owner.comparePassword(password);
    if (!isPasswordValid) {
        throw ApiError.unauthorized('Invalid email or password');
    }

    // Generate owner JWT — no tenantId, no branchId
    const payload = {
        userId: owner._id,
        role: 'owner',
        email: owner.email,
        tenantId: '',
        branchId: '',
        roleId: '',
    };

    const tokens = {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken({ userId: owner._id }),
        expiresIn: env.JWT_EXPIRES_IN,
    };

    // Update last login
    owner.lastLoginAt = new Date();
    owner.lastLoginIp = req.ip || req.headers['x-forwarded-for'] || '';
    await owner.save();

    ApiResponse.success(res, {
        user: owner.toJSON(),
        tokens,
        permissions: {},
        modules: [],
        branches: [],
    }, 'Owner login successful');
});

module.exports = {
    sendOtp,
    verifyOtp,
    registerTenant,
    login,
    refreshToken,
    forgotPassword,
    resetPassword,
    logout,
    getMe,
    switchBranch,
    ownerLogin,
};
