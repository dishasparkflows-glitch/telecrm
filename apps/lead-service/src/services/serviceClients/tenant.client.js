const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const getCustomFieldDefinitions = async (tenantId, entity) => {
    if (!tenantId || !entity) return [];
    try {
        const queryParams = new URLSearchParams({ tenantId: String(tenantId) });
        const path = `/internal/custom-fields/${entity}?${queryParams.toString()}`;
        const headers = createServiceHeaders({
            issuer: 'lead-service',
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
        console.warn(`Fetch custom fields failed for ${entity}: ${error.message}`);
        return [];
    }
};

const getUserIntegrationConfig = async (tenantId, userId, provider) => {
    if (!tenantId || !userId || !provider) return null;
    try {
        const path = `/internal/user-integration-config/${tenantId}/${userId}/${provider}`;
        const headers = createServiceHeaders({
            issuer: 'lead-service',
            audience: 'tenant-service',
            method: 'GET',
            path,
            identity: { tenantId: String(tenantId), userId: String(userId) },
        });
        
        const response = await axios.get(`${env.SERVICES.TENANT}${path}`, { headers, timeout: 5000 });
        return response.data?.data || null;
    } catch (error) {
        if (error.response?.status !== 404) {
            console.warn(`Fetch integration config failed for ${provider}: ${error.message}`);
        }
        return null;
    }
};

module.exports = { 
    getCustomFieldDefinitions,
    getUserIntegrationConfig
};
