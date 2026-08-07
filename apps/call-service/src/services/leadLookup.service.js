const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const findLeadByPhone = async (tenantId, phone) => {
    if (!tenantId || !phone) return null;
    try {
        const path = `/internal/leads/by-phone/${encodeURIComponent(phone)}`;
        const headers = createServiceHeaders({
            issuer: 'call-service',
            audience: 'lead-service',
            method: 'GET',
            path,
            identity: { tenantId: String(tenantId) },
        });
        const response = await axios.get(
            `${env.SERVICES.LEAD}${path}`,
            { headers, timeout: 5000 }
        );
        return response.data?.data || null;
    } catch (error) {
        if (error.response?.status === 404) return null;
        console.warn(`Mobile call lead lookup failed: ${error.message}`);
        return null;
    }
};

module.exports = { findLeadByPhone };
