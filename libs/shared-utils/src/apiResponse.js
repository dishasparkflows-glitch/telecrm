/**
 * Standard API response wrapper
 */
class ApiResponse {
    constructor(statusCode, data, message = 'Success') {
        this.statusCode = statusCode;
        this.success = statusCode < 400;
        this.message = message;
        this.data = data;
    }

    static success(res, data, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    }

    static created(res, data, message = 'Created successfully') {
        return res.status(201).json({
            success: true,
            message,
            data,
        });
    }

    static paginated(res, data, pagination, message = 'Success') {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination,
        });
    }
}

module.exports = { ApiResponse };
