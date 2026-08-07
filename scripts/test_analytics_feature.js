const axios = require('axios');

(async () => {
    try {
        // 1. Login to get token
        console.log('Logging in as invoice@gmail.com...');
        const loginRes = await axios.post('http://localhost:8000/api/auth/login', {
            email: 'invoice@gmail.com',
            password: '12345678'
        });

        const token = loginRes.data.data.tokens.accessToken;
        console.log('✅ Logged in successfully');

        // 2. Hit the analytics dashboard endpoint
        console.log('Fetching analytics dashboard...');
        const analyticsRes = await axios.get('http://localhost:8000/api/analytics/dashboard', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('✅ Analytics response successful:', analyticsRes.data.success);

    } catch (err) {
        console.error('❌ Request failed with status:', err.response?.status);
        console.error('Response body:', err.response?.data);
    }
})();
