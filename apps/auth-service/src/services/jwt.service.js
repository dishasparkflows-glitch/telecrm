const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');

/**
 * Generate access token
 */
const generateAccessToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
    return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

/**
 * Hash a refresh token for safe persistence and comparison.
 */
const hashRefreshToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate both tokens for a user
 */
const generateTokenPair = (user, roleSlug = '') => {
    const payload = {
        userId: user._id,
        tenantId: user.tenantId,
        role: roleSlug,
        email: user.contact?.email || '',
        branchId: user.branchId || '',
        roleId: user.roleId || '',
        whatsappNumber: user.contact?.whatsappNumber || '',
        mobileNumber: user.contact?.mobileNumber || '',
        tokenVersion: user.tokenVersion,
    };

    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken({
            userId: user._id,
            tokenVersion: user.tokenVersion,
            type: 'user',
        }),
        expiresIn: env.JWT_EXPIRES_IN,
    };
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    hashRefreshToken,
    generateTokenPair,
};
