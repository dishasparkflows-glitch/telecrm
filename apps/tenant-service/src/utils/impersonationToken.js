const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');

const IMPERSONATION_ISSUER = 'sparkcrm-tenant-service';
const IMPERSONATION_AUDIENCE = 'sparkcrm-tenant-impersonation';

function signImpersonationToken(payload, options = {}) {
    return jwt.sign(payload, options.secret || env.JWT_SECRET, {
        expiresIn: options.expiresIn || '2h',
        issuer: IMPERSONATION_ISSUER,
        audience: IMPERSONATION_AUDIENCE,
    });
}

module.exports = {
    IMPERSONATION_AUDIENCE,
    IMPERSONATION_ISSUER,
    signImpersonationToken,
};
