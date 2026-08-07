const axios = require('axios');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        // tenant-service runs on 8002 locally
        // using the tenant ID from the diagnostic script
        const tenantId = '69a1303a8d8106eb0017d97d';

        console.log(`Fetching from internal tenant API for ID: ${tenantId}...`);
        const response = await axios.get(`http://localhost:8002/internal/tenants/${tenantId}`);

        fs.writeFileSync(path.resolve(__dirname, 'tenant_api_diag.txt'), JSON.stringify(response.data, null, 2));
        console.log('✅ Wrote API response to tenant_api_diag.txt');

    } catch (err) {
        console.error('❌ Error fetching from internal API:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
})();
