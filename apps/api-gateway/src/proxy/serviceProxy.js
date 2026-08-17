const { createProxyMiddleware } = require('http-proxy-middleware');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders, TRUSTED_IDENTITY_HEADERS } = require('@sparkcrm/shared-middleware');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { tenantResolver } = require('../middlewares/tenantResolver.middleware');
const { trialGuard } = require('../middlewares/trialGuard.middleware');
const { rbac } = require('../middlewares/rbac.middleware');
const { featureGuard } = require('../middlewares/featureGuard.middleware');
const { permissionGuard } = require('../middlewares/permissionGuard.middleware');
const { ownerGuard } = require('../middlewares/ownerGuard.middleware');
const { globalLimiter, authLimiter, apiLimiter } = require('../middlewares/rateLimiter.middleware');
const { ROLES } = require('@sparkcrm/shared-utils');

/**
 * Service route mapping with middleware configuration
 */
const SERVICE_ROUTES = {
    '/api/auth': {
        target: env.SERVICES.AUTH,
        rateLimiter: authLimiter,
        publicPaths: [
            /\/api\/auth\/login$/,
            /\/api\/auth\/login-2fa$/,
            /\/api\/auth\/register-tenant$/,
            /\/api\/auth\/send-otp$/,
            /\/api\/auth\/verify-otp$/,
            /\/api\/auth\/forgot-password$/,
            /\/api\/auth\/reset-password$/,
            /\/api\/auth\/refresh-token$/,
            /\/api\/auth\/owner-login$/,
        ],
    },
    '/api/plans': {
        target: env.SERVICES.TENANT,
        publicPaths: [
            { method: 'GET', pattern: /^\/api\/plans(?:\/[^/]+)?\/?$/ },
        ],
    },
    '/api/tenants': {
        target: env.SERVICES.TENANT,
    },
    '/api/users': {
        target: env.SERVICES.AUTH,
        module: 'users',
        minRole: ROLES.ADMIN,
    },
    '/api/leads': {
        target: env.SERVICES.LEAD,
        module: 'leads',
        feature: 'lead_management',
        publicPaths: [
            { method: 'GET', pattern: /^\/api\/leads\/webhooks\/meta\/?$/ },
            { method: 'POST', pattern: /^\/api\/leads\/webhooks\/meta\/?$/ },
            { method: 'POST', pattern: /^\/api\/leads\/webhooks\/inbound\/[a-f0-9]{24}\/?$/ },
            { method: 'GET', pattern: /^\/api\/leads\/oauth\/meta\/callback\/?$/ },
        ],
    },
    '/api/follow-ups': {
        target: env.SERVICES.LEAD,
        module: 'followups',
        feature: 'lead_management',
    },
    '/api/calls': {
        target: env.SERVICES.CALL,
        module: 'calls',
        feature: 'calling_basic',
    },
    '/api/whatsapp': {
        target: env.SERVICES.WHATSAPP,
        module: 'whatsapp',
        feature: 'whatsapp_session',
    },
    '/api/automations': {
        target: env.SERVICES.AUTOMATION,
        module: 'automations',
        feature: 'automation_basic',
    },
    '/api/analytics': {
        target: env.SERVICES.ANALYTICS,
        module: 'analytics',
        feature: 'analytics_basic',
    },
    '/api/billing': {
        target: env.SERVICES.BILLING,
        module: 'billing',
        publicPaths: [
            { method: 'POST', pattern: /^\/api\/billing\/webhooks\/(stripe|razorpay)\/?$/ },
        ],
    },
    '/api/payments': {
        target: env.SERVICES.BILLING,
        publicPaths: [
            { method: 'GET', pattern: /^\/api\/payments\/active-methods\/?$/ },
        ],
        isOwner: true, // Only applies to non-public paths
    },
    '/api/features': {
        target: env.SERVICES.BILLING,
    },
    '/api/notifications': {
        target: env.SERVICES.NOTIFICATION,
        module: 'notifications',
    },
    '/api/forms': {
        target: env.SERVICES.FORM,
        module: 'forms',
        feature: 'smart_forms',
        publicPaths: [
            { method: 'POST', pattern: /^\/api\/forms\/[a-f0-9]+\/submit\/?$/ },
        ],
    },
    '/api/meetings': {
        target: env.SERVICES.MEETING,
        module: 'meetings',
        feature: 'meeting_scheduler',
        publicPaths: [
            { method: 'GET', pattern: /^\/api\/meetings\/book\/[^/]+\/?$/ },
            { method: 'POST', pattern: /^\/api\/meetings\/book\/[^/]+\/?$/ },
            { method: 'GET', pattern: /^\/api\/meetings\/book\/[^/]+\/availability\/?$/ },
            { method: 'GET', pattern: /^\/api\/meetings\/google\/callback\/?$/ },
        ],
    },
    '/api/referral': {
        target: env.SERVICES.TENANT,
    },
    '/api/audit': {
        target: env.SERVICES.TENANT,
        module: 'audit',
        minRole: ROLES.ADMIN,
    },
    '/api/roles': {
        target: env.SERVICES.TENANT,
        module: 'roles',
        minRole: ROLES.SUPER_ADMIN,
    },
    '/api/modules': {
        target: env.SERVICES.TENANT,
    },
    '/api/branches': {
        target: env.SERVICES.TENANT,
        module: 'branches',
    },
    '/api/uploads': {
        target: env.SERVICES.UPLOAD,
    },
    '/api/custom-fields': {
        target: env.SERVICES.TENANT,
    },
    '/api/integrations': {
        target: env.SERVICES.TENANT,
        minRole: ROLES.ADMIN,
    },
    '/api/owner': {
        target: env.SERVICES.TENANT,
        isOwner: true,
    },
    '/webhooks/exotel': {
        target: env.SERVICES.CALL,
        public: true,
    },
    '/webhooks/twilio': {
        target: env.SERVICES.CALL,
        public: true,
    },
    '/webhooks/whatsapp': {
        target: env.SERVICES.WHATSAPP,
        public: true,
    },
    '/webhooks/razorpay': {
        target: env.SERVICES.BILLING,
        public: true,
    },
    '/socket.io': {
        target: env.SERVICES.WHATSAPP,
        public: true,
        websocket: true,
    },
    '/socket.io-notifications': {
        target: env.SERVICES.NOTIFICATION,
        public: true,
        websocket: true,
    },
};

const TARGET_AUDIENCES = new Map([
    [env.SERVICES.AUTH, 'auth-service'],
    [env.SERVICES.TENANT, 'tenant-service'],
    [env.SERVICES.LEAD, 'lead-service'],
    [env.SERVICES.CALL, 'call-service'],
    [env.SERVICES.WHATSAPP, 'whatsapp-service'],
    [env.SERVICES.AUTOMATION, 'automation-service'],
    [env.SERVICES.ANALYTICS, 'analytics-service'],
    [env.SERVICES.BILLING, 'billing-service'],
    [env.SERVICES.NOTIFICATION, 'notification-service'],
    [env.SERVICES.FORM, 'form-service'],
    [env.SERVICES.MEETING, 'meeting-service'],
    [env.SERVICES.UPLOAD, 'upload-service'],
]);

/**
 * Match public exceptions by normalized path and, where configured, method.
 * Regex-only entries remain supported for existing auth routes.
 */
const isPublicRequest = (config, req) => {
    const requestPath = req.path || req.originalUrl.split('?')[0];
    return (config.publicPaths || []).some((entry) => {
        if (entry instanceof RegExp) return entry.test(requestPath);
        return entry.method === req.method && entry.pattern.test(requestPath);
    });
};

const createGatewayServiceHeaders = (config, audience, req) => {
    if (config.public || isPublicRequest(config, req)) return null;

    const permissions = req.headers['x-user-permissions'];
    return createServiceHeaders({
        issuer: 'api-gateway',
        audience,
        method: req.method,
        path: req.originalUrl,
        identity: {
            userId: req.userId,
            tenantId: req.tenantId,
            role: req.userRole,
            email: req.userEmail,
            whatsappNumber: req.userWhatsapp,
            mobileNumber: req.userMobile,
            branchId: req.userBranchId,
            roleId: req.userRoleId,
            permissions,
            isImpersonating: req.isImpersonating === true,
            isTrial: req.isTrial === true,
            tenantCallingNumber: req.headers['x-tenant-calling-number'],
        },
    });
};

/**
 * Remove identity and authorization context that only the gateway may set.
 * The client-selected X-Branch-Id is intentionally preserved.
 */
const stripUntrustedIdentityHeaders = (req, res, next) => {
    TRUSTED_IDENTITY_HEADERS.forEach((header) => delete req.headers[header]);
    next();
};

/**
 * Check if the request path matches the target prefix exactly or as a sub-path.
 */
const isPathMatch = (reqPath, targetPath) => {
    if (reqPath === targetPath) return true;
    if (reqPath.startsWith(targetPath + '/')) return true;
    if (reqPath.startsWith(targetPath + '?')) return true;
    return false;
};

/**
 * Build middleware chain for a route based on its configuration
 */
const buildMiddlewareChain = (config) => {
    const middlewares = [];

    // Rate limiter (always first)
    middlewares.push(config.rateLimiter || apiLimiter);

    // Public routes skip auth, tenant, trial, rbac, feature guards
    if (config.public) {
        return middlewares;
    }

    // Owner routes: auth + ownerGuard only (no tenant/trial/permission/feature guards)
    if (config.isOwner) {
        if (config.publicPaths) {
            const conditionalAuth = (req, res, next) => {
                if (isPublicRequest(config, req)) return next();
                return authMiddleware(req, res, next);
            };
            const conditionalOwner = (req, res, next) => {
                if (isPublicRequest(config, req)) return next();
                return ownerGuard(req, res, next);
            };
            middlewares.push(conditionalAuth, conditionalOwner);
        } else {
            middlewares.push(authMiddleware);
            middlewares.push(ownerGuard);
        }
        return middlewares;
    }

    // Some routes have specific public sub-paths
    if (config.publicPaths) {
        const conditionalAuth = (req, res, next) => {
            if (isPublicRequest(config, req)) return next();
            return authMiddleware(req, res, next);
        };
        const conditionalTenant = (req, res, next) => {
            if (isPublicRequest(config, req)) return next();
            return tenantResolver(req, res, next);
        };
        const conditionalTrial = (req, res, next) => {
            if (isPublicRequest(config, req)) return next();
            return trialGuard(req, res, next);
        };
        middlewares.push(conditionalAuth, conditionalTenant, conditionalTrial);
    } else {
        middlewares.push(authMiddleware);
        middlewares.push(tenantResolver);
        middlewares.push(trialGuard);
    }

    if (config.minRole) {
        if (config.publicPaths) {
            middlewares.push((req, res, next) => {
                if (isPublicRequest(config, req)) return next();
                return rbac(config.minRole)(req, res, next);
            });
        } else {
            middlewares.push(rbac(config.minRole));
        }
    }

    if (config.feature) {
        if (config.publicPaths) {
            middlewares.push((req, res, next) => {
                if (isPublicRequest(config, req)) return next();
                return featureGuard(config.feature)(req, res, next);
            });
        } else {
            middlewares.push(featureGuard(config.feature));
        }
    }

    // Per-module CRUD permission check
    if (config.module) {
        if (config.publicPaths) {
            middlewares.push((req, res, next) => {
                if (isPublicRequest(config, req)) return next();
                return permissionGuard(config.module)(req, res, next);
            });
        } else {
            middlewares.push(permissionGuard(config.module));
        }
    }

    return middlewares;
};

/**
 * Run a chain of Express middlewares in sequence, then call done() when all pass.
 */
const runMiddlewareChain = (middlewares, req, res, done) => {
    let idx = 0;
    const next = (err) => {
        if (err) return done(err);
        if (idx >= middlewares.length) return done();
        const mw = middlewares[idx++];
        try {
            mw(req, res, next);
        } catch (e) {
            done(e);
        }
    };
    next();
};

/**
 * Setup all proxy routes on the Express app.
 *
 * IMPORTANT: We register each proxy at the ROOT level with `app.use(proxy)`
 * and use `pathFilter` for matching. This avoids Express's `app.use(path)`
 * stripping the prefix — the FULL original URL is forwarded to downstream
 * services (e.g. /api/auth/login → http://localhost:8001/api/auth/login).
 *
 * Middleware (auth, tenant, RBAC, etc.) runs INSIDE the pathFilter function
 * before allowing the proxy to forward the request.
 */
const websocketProxies = [];

const setupProxies = (app) => {
    // Apply abuse protection before replacing untrusted identity context.
    app.use(globalLimiter);
    app.use(stripUntrustedIdentityHeaders);

    Object.entries(SERVICE_ROUTES).forEach(([path, config]) => {
        const middlewares = buildMiddlewareChain(config);
        const audience = TARGET_AUDIENCES.get(config.target);
        if (!audience) throw new Error(`No service identity audience configured for ${path}`);

        // Create proxy registered at ROOT level with pathFilter
        const proxy = createProxyMiddleware({
            target: config.target,
            changeOrigin: true,
            ws: config.websocket === true,
            // pathFilter matches requests that start with this prefix exactly or as sub-path
            pathFilter: (reqPath) => isPathMatch(reqPath, path),
            on: {
                proxyReq: (proxyReq, req) => {
                    if (req.userId) proxyReq.setHeader('X-User-Id', req.userId);
                    if (req.tenantId) proxyReq.setHeader('X-Tenant-Id', req.tenantId);
                    if (req.userRole) proxyReq.setHeader('X-User-Role', req.userRole);
                    if (req.userEmail) proxyReq.setHeader('X-User-Email', req.userEmail);
                    if (req.isTrial !== undefined) proxyReq.setHeader('X-Is-Trial', String(req.isTrial));
                    if (req.isImpersonating) proxyReq.setHeader('X-Is-Impersonating', 'true');
                    // Forward user's assigned branch from JWT
                    if (req.userBranchId) proxyReq.setHeader('X-User-Branch-Id', req.userBranchId);
                    if (req.userRoleId) proxyReq.setHeader('X-User-Role-Id', req.userRoleId);
                    // Forward selected branch context from client
                    const branchId = req.headers['x-branch-id'];
                    if (branchId) proxyReq.setHeader('X-Branch-Id', branchId);
                    // Forward permissions
                    const perms = req.headers['x-user-permissions'];
                    if (perms) proxyReq.setHeader('X-User-Permissions', perms);

                    const serviceHeaders = createGatewayServiceHeaders(config, audience, req);
                    for (const [header, value] of Object.entries(serviceHeaders || {})) {
                        proxyReq.setHeader(header, value);
                    }
                },
                error: (err, req, res) => {
                    console.error(`❌ Proxy error for ${path}:`, err.message);
                    if (res && typeof res.status === 'function') {
                        if (!res.headersSent) {
                            res.status(502).json({
                                success: false,
                                message: `Service at ${path} is currently unavailable`,
                                error: env.isDev ? err.message : undefined,
                            });
                        }
                    } else if (res && typeof res.end === 'function') {
                        // Handles WebSocket upgrade requests where 'res' is a socket
                        res.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
                    }
                },
            },
        });

        if (config.websocket) websocketProxies.push({ path, proxy });

        // Wrap: run middleware chain first, then proxy
        app.use((req, res, next) => {
            // Only handle requests matching this route's path prefix
            if (!isPathMatch(req.originalUrl, path)) return next();

            // Run the middleware chain (rate limiter, auth, tenant, etc.)
            runMiddlewareChain(middlewares, req, res, (err) => {
                if (err) return next(err);
                // If response was already sent by middleware (e.g. 401, 403), stop
                if (res.headersSent) return;
                // Forward to proxy
                proxy(req, res, next);
            });
        });

        const flags = [
            config.public ? '🌐 public' : '🔐 protected',
            config.feature ? `📦 ${config.feature}` : '',
            config.minRole ? `👤 ${config.minRole}+` : '',
        ].filter(Boolean).join(' | ');

        console.log(`🔀 ${path} → ${config.target} [${flags}]`);
    });
};

const attachWebSocketUpgrades = (server) => {
    server.on('upgrade', (req, socket, head) => {
        const entry = websocketProxies.find(({ path }) => isPathMatch(req.url, path));
        if (entry) entry.proxy.upgrade(req, socket, head);
        else socket.destroy();
    });
};

module.exports = {
    setupProxies,
    attachWebSocketUpgrades,
    SERVICE_ROUTES,
    createGatewayServiceHeaders,
    isPublicRequest,
};
