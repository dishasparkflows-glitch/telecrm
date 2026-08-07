const axios = require('axios');
const mongoose = require('mongoose');
const { env } = require('../libs/shared-config/src/env');
const PaymentConfig = require('../apps/billing-service/src/models/PaymentConfig');
const { requiredEnvList } = require('./_safety');

const api = axios.create({
    baseURL: 'http://localhost:8000',
});

async function run() {
    const values = requiredEnvList([
        'OWNER_TEST_EMAIL',
        'OWNER_TEST_PASSWORD',
        'PAYMENT_TEST_KEY_ID',
        'PAYMENT_TEST_KEY_SECRET',
        'PAYMENT_TEST_WEBHOOK_SECRET',
    ]);

    console.log('Connecting to DB to check encryption...');
    await mongoose.connect(env.MONGO.BILLING);

    try {
        // 1. Owner Login
        const loginRes = await api.post('/api/auth/owner-login', {
            email: values.OWNER_TEST_EMAIL,
            password: values.OWNER_TEST_PASSWORD,
        });
        const token = loginRes.data.data.tokens.accessToken;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        console.log('✅ Owner logged in');

        // 2. Save Config
        const configPath = '/api/payments/configs';
        await api.post(configPath, {
            provider: 'razorpay',
            displayName: 'Razorpay Live',
            isActive: true,
            credentials: {
                keyId: values.PAYMENT_TEST_KEY_ID,
                keySecret: values.PAYMENT_TEST_KEY_SECRET,
            },
            webhookSecret: values.PAYMENT_TEST_WEBHOOK_SECRET
        });
        console.log('✅ Saved Razorpay config via API');

        // 3. Fetch Configs (Sanitization Check)
        const getRes = await api.get(configPath);
        const apiConfig = getRes.data.data.find(c => c.provider === 'razorpay');
        console.log('\n--- API Output (Should be sanitized) ---');
        console.log(JSON.stringify(getRes.data, null, 2));
        console.log('Credentials:', apiConfig.credentials);
        console.log('WebhookSecret:', apiConfig.webhookSecret);

        if (apiConfig.credentials.keySecret === true && apiConfig.webhookSecret === '********') {
            console.log('✅ API successfully sanitized output');
        } else {
            console.error('❌ API FAILED to sanitize output!');
        }

        // 4. DB Check (Encryption Check)
        const dbConfig = await PaymentConfig.findOne({ provider: 'razorpay' });
        console.log('\n--- DB Output (Should be AES-256 encrypted string) ---');
        console.log('Raw keySecret in DB:', dbConfig.credentials.get('keySecret').substring(0, 30) + '...');

        if (dbConfig.credentials.get('keySecret').includes(':')) {
            console.log('✅ Database successfully stored encrypted AES-256-GCM string cipher');
        } else {
            console.error('❌ Database FAILED to encrypt secret!');
        }

    } catch (error) {
        console.error('Test Failed:', error?.response?.data || error.message);
    } finally {
        await mongoose.disconnect();
    }
}

run();
