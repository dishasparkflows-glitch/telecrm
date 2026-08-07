/**
 * Request logger middleware — logs method, URL, status, and response time
 */
const requestLogger = (serviceName = 'service') => {
    return (req, res, next) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            const status = res.statusCode;
            const color = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢';
            console.log(
                `${color} [${serviceName}] ${req.method} ${req.originalUrl} → ${status} (${duration}ms)`
            );
        });

        next();
    };
};

module.exports = { requestLogger };
