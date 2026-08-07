/**
 * Shared input validators for common field patterns
 */

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+]?[\d\s-]{7,15}$/;
const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const isValidEmail = (email) => emailRegex.test(email);
const isValidPhone = (phone) => phoneRegex.test(phone);
const isValidObjectId = (id) => objectIdRegex.test(id);

/**
 * Validate required fields — returns array of missing field names
 */
const validateRequired = (data, requiredFields) => {
    const missing = [];
    for (const field of requiredFields) {
        const value = data[field];
        if (value === undefined || value === null || value === '') {
            missing.push(field);
        }
    }
    return missing;
};

/**
 * Sanitize a string (trim + lowercase)
 */
const sanitizeEmail = (email) => (email ? email.trim().toLowerCase() : '');
const sanitizeString = (str) => (str ? str.trim() : '');

/**
 * Validate password strength
 */
const isStrongPassword = (password) => {
    if (!password || password.length < 8) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    return hasUpper && hasLower && hasNumber;
};

module.exports = {
    isValidEmail,
    isValidPhone,
    isValidObjectId,
    validateRequired,
    sanitizeEmail,
    sanitizeString,
    isStrongPassword,
};
