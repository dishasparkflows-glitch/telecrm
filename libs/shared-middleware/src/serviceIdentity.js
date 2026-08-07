const crypto = require('crypto');
const { env } = require('@sparkcrm/shared-config');

const CONTEXT_HEADER = 'x-service-context';
const SIGNATURE_HEADER = 'x-service-signature';
const MAX_CLOCK_SKEW_MS = 30_000;
const seenNonces = new Map();

const TRUSTED_IDENTITY_HEADERS = [
    'x-user-id',
    'x-tenant-id',
    'x-user-role',
    'x-user-email',
    'x-user-whatsapp',
    'x-user-mobile',
    'x-user-branch-id',
    'x-user-role-id',
    'x-user-permissions',
    'x-is-impersonating',
    'x-is-trial',
    'x-tenant-calling-number',
    CONTEXT_HEADER,
    SIGNATURE_HEADER,
];

function requireSigningSecret() {
    const secret = process.env.INTERNAL_SERVICE_SECRET || env.INTERNAL_SERVICE_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('INTERNAL_SERVICE_SECRET is not securely configured');
    }
    return secret;
}

function canonicalRequest(method, path, encodedContext) {
    return `${String(method).toUpperCase()}\n${path}\n${encodedContext}`;
}

function signEncodedContext(encodedContext, method, path) {
    return crypto
        .createHmac('sha256', requireSigningSecret())
        .update(canonicalRequest(method, path, encodedContext))
        .digest('base64url');
}

function createServiceHeaders({ issuer, audience, method, path, identity = {}, ttlMs = MAX_CLOCK_SKEW_MS }) {
    const now = Date.now();
    const payload = {
        v: 1,
        issuer,
        audience,
        issuedAt: now,
        expiresAt: now + ttlMs,
        nonce: crypto.randomBytes(12).toString('base64url'),
        identity,
    };
    const encodedContext = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return {
        'X-Service-Context': encodedContext,
        'X-Service-Signature': signEncodedContext(encodedContext, method, path),
    };
}

function verifyServiceContext(req, expectedAudience, options = {}) {
    const encodedContext = req.headers[CONTEXT_HEADER];
    const providedSignature = req.headers[SIGNATURE_HEADER];
    if (!encodedContext || !providedSignature) throw new Error('Signed service identity is required');

    const expectedSignature = signEncodedContext(encodedContext, req.method, req.originalUrl || req.url);
    const expected = Buffer.from(expectedSignature);
    const provided = Buffer.from(String(providedSignature));
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        throw new Error('Invalid service identity signature');
    }

    let context;
    try {
        context = JSON.parse(Buffer.from(encodedContext, 'base64url').toString('utf8'));
    } catch {
        throw new Error('Invalid service identity context');
    }

    const now = Date.now();
    if (context.v !== 1 || !context.issuer || !context.audience || !context.nonce) {
        throw new Error('Incomplete service identity context');
    }
    if (!Number.isFinite(context.issuedAt) || !Number.isFinite(context.expiresAt)) {
        throw new Error('Invalid service identity timestamps');
    }
    if (
        context.expiresAt <= context.issuedAt
        || context.expiresAt - context.issuedAt > MAX_CLOCK_SKEW_MS
        || context.issuedAt > now + MAX_CLOCK_SKEW_MS
        || context.expiresAt < now
    ) {
        throw new Error('Expired service identity context');
    }
    if (expectedAudience && context.audience !== expectedAudience) {
        throw new Error('Service identity audience mismatch');
    }
    if (options.allowedIssuers && !options.allowedIssuers.includes(context.issuer)) {
        throw new Error('Service identity issuer is not allowed');
    }

    if (seenNonces.has(context.nonce)) throw new Error('Service identity context was already used');
    seenNonces.set(context.nonce, context.expiresAt);
    const cleanupTimer = setTimeout(() => seenNonces.delete(context.nonce), Math.max(1, context.expiresAt - now));
    cleanupTimer.unref?.();
    return context;
}

function applyVerifiedIdentity(req, context) {
    const identity = context.identity || {};
    const headerMap = {
        userId: 'x-user-id',
        tenantId: 'x-tenant-id',
        role: 'x-user-role',
        email: 'x-user-email',
        whatsappNumber: 'x-user-whatsapp',
        mobileNumber: 'x-user-mobile',
        branchId: 'x-user-branch-id',
        roleId: 'x-user-role-id',
        permissions: 'x-user-permissions',
        isImpersonating: 'x-is-impersonating',
        isTrial: 'x-is-trial',
        tenantCallingNumber: 'x-tenant-calling-number',
    };

    for (const [key, header] of Object.entries(headerMap)) {
        const value = identity[key];
        if (value === undefined || value === null || value === '') delete req.headers[header];
        else req.headers[header] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    req.serviceIdentity = context;
    req.userId = identity.userId;
    req.tenantId = identity.tenantId;
    req.userRole = identity.role;
    req.userEmail = identity.email;
    req.userBranchId = identity.branchId;
    req.userRoleId = identity.roleId;
    req.isImpersonating = identity.isImpersonating === true;
    req.isTrial = identity.isTrial === true;
    req.tenantCallingNumber = identity.tenantCallingNumber;
}

const requireServiceIdentity = (audience, options = {}) => (req, res, next) => {
    try {
        const context = verifyServiceContext(req, audience, {
            allowedIssuers: options.allowedIssuers,
        });
        if (options.requireUser && !context.identity?.userId) {
            return res.status(401).json({ success: false, message: 'Authenticated user identity is required' });
        }
        applyVerifiedIdentity(req, context);
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: error.message });
    }
};

function stripUntrustedIdentityHeaders(req, res, next) {
    for (const header of TRUSTED_IDENTITY_HEADERS) delete req.headers[header];
    next();
}

module.exports = {
    CONTEXT_HEADER,
    SIGNATURE_HEADER,
    TRUSTED_IDENTITY_HEADERS,
    createServiceHeaders,
    verifyServiceContext,
    applyVerifiedIdentity,
    requireServiceIdentity,
    stripUntrustedIdentityHeaders,
};
