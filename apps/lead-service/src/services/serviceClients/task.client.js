const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const checkTaskOverlap = async (tenantId, userId, date) => {
    if (!tenantId || !userId || !date) return false;
    try {
        const queryParams = new URLSearchParams({ 
            from: date.toISOString(), 
            to: date.toISOString()
        });
        const path = `/api/tasks/calendar?${queryParams.toString()}`;
        const headers = createServiceHeaders({
            issuer: 'lead-service',
            audience: 'task-service',
            method: 'GET',
            path,
            identity: { tenantId: String(tenantId), userId: String(userId) },
        });
        
        // Explicitly pass standard context headers used by task-service
        headers['x-tenant-id'] = String(tenantId);
        headers['x-user-id'] = String(userId);
        
        const response = await axios.get(
            `${env.SERVICES.TASK}${path}`,
            { headers, timeout: 5000 }
        );
        
        const tasks = response.data?.data?.tasks || [];
        return tasks.some(t => new Date(t.dueDate).getTime() === date.getTime());
    } catch (error) {
        console.warn(`Task overlap check failed: ${error.message}`);
        return false;
    }
};

module.exports = { checkTaskOverlap };
