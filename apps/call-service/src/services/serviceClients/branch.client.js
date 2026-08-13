const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const getBranchesBulk = async (tenantId, ids) => {
    if (!tenantId || !ids || ids.length === 0) return [];
    try {
        const queryParams = new URLSearchParams({ ids: ids.join(',') });
        const path = `/internal/branches/bulk?${queryParams.toString()}`;
        const headers = createServiceHeaders({
            issuer: 'call-service',
            audience: 'tenant-service',
            method: 'GET',
            path,
            identity: { tenantId: String(tenantId) },
        });
        
        const response = await axios.get(
            `${env.SERVICES.TENANT}${path}`,
            { headers, timeout: 5000 }
        );
        return response.data?.data || [];
    } catch (error) {
        console.warn(`Bulk branch lookup failed: ${error.message}`);
        return [];
    }
};

module.exports = { getBranchesBulk };
