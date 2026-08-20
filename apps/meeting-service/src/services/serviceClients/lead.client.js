const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const createOrFindLead = async (tenantId, payload) => {
    try {
        const headers = createServiceHeaders({
            issuer: 'meeting-service',
            audience: 'lead-service',
            method: 'POST',
            path: '/internal/leads/ingest',
            identity: { tenantId: String(tenantId) },
        });

        const response = await axios.post(
            `${env.SERVICES.LEAD}/internal/leads/ingest`,
            payload,
            { headers, timeout: 5000 }
        );
        return response.data?.data?.lead || null;
    } catch (error) {
        console.error(`Lead ingestion failed:`, error.response?.data || error.message);
        return null;
    }
};

const getLeadsBulk = async (tenantId, ids) => {
    if (!ids || ids.length === 0) return [];
    try {
        const queryParams = new URLSearchParams({ ids: ids.join(','), tenantId: String(tenantId) });
        const path = `/internal/leads/bulk?${queryParams.toString()}`;
        const headers = createServiceHeaders({
            issuer: 'meeting-service',
            audience: 'lead-service',
            method: 'GET',
            path,
            identity: { tenantId: String(tenantId) },
        });

        const response = await axios.get(
            `${env.SERVICES.LEAD}${path}`,
            { headers, timeout: 5000 }
        );
        return response.data?.data || [];
    } catch (error) {
        console.error(`Bulk lead fetch failed:`, error.response?.data || error.message);
        return [];
    }
};

module.exports = { createOrFindLead, getLeadsBulk };
