

/**
 * Global error handler middleware
 * Must be registered as the LAST middleware in Express
 */
const errorHandler = (err, req, res, _next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';
    let errors = err.errors || [];

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation error';
        errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue)[0];
        message = `${field} already exists`;
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }

    // Log errors in development
    if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Error:', {
            statusCode,
            message,
            stack: err.stack,
            ...(errors.length && { errors }),
        });
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(errors.length && { errors }),
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

module.exports = { errorHandler };
