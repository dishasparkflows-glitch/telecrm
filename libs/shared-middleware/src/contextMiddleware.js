const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();

const contextMiddleware = (req, res, next) => {
    const store = {
        userId: req.headers['x-user-id'] || null,
        tenantId: req.headers['x-tenant-id'] || null,
    };
    
    requestContext.run(store, () => {
        next();
    });
};

module.exports = {
    requestContext,
    contextMiddleware
};
