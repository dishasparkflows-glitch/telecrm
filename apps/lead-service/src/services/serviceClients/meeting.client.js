const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const checkMeetingOverlap = async (tenantId, userId, date) => {
    if (!tenantId || !userId || !date) return false;
    try {
        const queryParams = new URLSearchParams({ tenantId, userId, date: date.toISOString() });
        const path = `/internal/meetings/check-overlap?${queryParams.toString()}`;
        const headers = createServiceHeaders({
            issuer: 'lead-service',
            audience: 'meeting-service',
            method: 'GET',
            path,
            identity: { tenantId: String(tenantId) },
        });
        
        const response = await axios.get(
            `${env.SERVICES.MEETING}${path}`,
            { headers, timeout: 5000 }
        );
        return response.data?.overlap || false;
    } catch (error) {
        console.warn(`Meeting overlap check failed: ${error.message}`);
        return false;
    }
};

module.exports = { checkMeetingOverlap };
