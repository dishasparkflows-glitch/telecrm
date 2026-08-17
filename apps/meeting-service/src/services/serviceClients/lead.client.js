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

module.exports = { createOrFindLead };
