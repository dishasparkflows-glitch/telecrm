const { ApiError } = require('@sparkcrm/shared-utils');
const { isValidEmail, isStrongPassword, validateRequired } = require('@sparkcrm/shared-utils/src/validators');

/**
 * Validate register-tenant request
 */
const validateRegister = (req, res, next) => {
    const { email, password } = req.body;

    const missing = validateRequired(req.body, ['companyName', 'email', 'password', 'firstName']);
    if (missing.length > 0) {
        return next(ApiError.badRequest(`Missing required fields: ${missing.join(', ')}`));
    }

    if (!isValidEmail(email)) {
        return next(ApiError.badRequest('Invalid email format'));
    }

    if (!isStrongPassword(password)) {
        return next(ApiError.badRequest('Password must be 8+ chars with uppercase, lowercase, and number'));
    }

    next();
};

/**
 * Validate login request
 */
const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(ApiError.badRequest('Email and password are required'));
    }

    if (!isValidEmail(email)) {
        return next(ApiError.badRequest('Invalid email format'));
    }

    next();
};

/**
 * Validate forgot-password request
 */
const validateForgotPassword = (req, res, next) => {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
        return next(ApiError.badRequest('Valid email is required'));
    }
    next();
};

module.exports = { validateRegister, validateLogin, validateForgotPassword };
