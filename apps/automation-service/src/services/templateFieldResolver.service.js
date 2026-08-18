const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

/**
 * Helper to build internal request configurations
 */
const buildInternalRequest = (method, path, targetServiceKey, tenantId) => {
    const targetUrl = env.SERVICES[targetServiceKey];
    if (!targetUrl) throw new Error(`Unknown target service: ${targetServiceKey}`);
    
    const audience = `${targetServiceKey.toLowerCase()}-service`;

    const headers = createServiceHeaders({
        issuer: 'automation-service',
        audience,
        method,
        path,
        identity: { tenantId: String(tenantId) },
    });

    return {
        url: `${targetUrl}${path}`,
        headers,
    };
};

/**
 * Resolves context for a given template and record.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.module - 'Lead', 'Meeting', etc.
 * @param {string} params.recordId
 */
const resolveTemplateContext = async ({ tenantId, module, recordId }) => {
    const context = {};

    // 1. Fetch Primary Record
    if (module === 'Lead') {
        try {
            const req = buildInternalRequest('GET', `/api/leads/${recordId}`, 'LEAD', tenantId);
            const res = await axios.get(req.url, { headers: req.headers });
            context.lead = res.data?.data || {};
            
            // 2. Fetch Assigned User if exists
            if (context.lead.assignedTo) {
                try {
                    const userReq = buildInternalRequest('GET', `/api/users/${context.lead.assignedTo}`, 'AUTH', tenantId);
                    const userRes = await axios.get(userReq.url, { headers: userReq.headers });
                    context.user = userRes.data?.data || {};
                } catch (e) {
                    console.warn(`Could not resolve user ${context.lead.assignedTo} for email template`);
                    context.user = {};
                }
            }

            // 3. Fetch Branch if exists
            if (context.lead.branchId) {
                try {
                    const branchReq = buildInternalRequest('GET', `/api/branches/${context.lead.branchId}`, 'TENANT', tenantId);
                    const branchRes = await axios.get(branchReq.url, { headers: branchReq.headers });
                    context.branch = branchRes.data?.data || {};
                } catch (e) {
                    console.warn(`Could not resolve branch ${context.lead.branchId} for email template`);
                    context.branch = {};
                }
            }
            
            // TODO: Company info could be fetched from tenant profile
            context.company = { name: 'SparkCRM Tenant' }; // Fallback for now

        } catch (error) {
            console.error('Error resolving template context for Lead:', error.message);
        }
    }

    return context;
};

module.exports = { resolveTemplateContext, buildInternalRequest };
