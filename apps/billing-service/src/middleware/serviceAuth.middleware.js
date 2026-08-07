const {
    createServiceHeaders,
    requireServiceIdentity,
} = require('@sparkcrm/shared-middleware');

const requireTrustedGateway = requireServiceIdentity('billing-service', {
    requireUser: true,
    allowedIssuers: ['api-gateway'],
});

const createTenantServiceHeaders = (method, path, identity = {}) => createServiceHeaders({
    issuer: 'billing-service',
    audience: 'tenant-service',
    method,
    path,
    identity,
});

module.exports = { requireTrustedGateway, createTenantServiceHeaders };
