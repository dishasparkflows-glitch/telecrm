/**
 * Wraps async route handlers to catch errors and pass to Express error handler
 * @param {Function} fn - Async Express handler
 * @returns {Function} - Wrapped handler
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = { asyncHandler };
