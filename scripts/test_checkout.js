const axios = require('axios');
const mongoose = require('mongoose');
const { env } = require('../libs/shared-config/src/env');

const User = require('../apps/auth-service/src/models/User');

const API_URL = 'http://localhost:8000/api';

async function run() {
    try {
        console.log('Connecting to DB to find a test tenant...');
        await mongoose.connect(env.MONGO.TENANT);
        await mongoose.connection.useDb('sparkcrm_auth');

        // Find standard user who owns a tenant
        const AuthUser = mongoose.connection.useDb('sparkcrm_auth').model('User', User.schema);
        const user = await AuthUser.findOne({ tenantId: { $exists: true, $ne: null } });

        if (!user) {
            console.log('No test tenant found in the DB. Please register one manually.');
            process.exit(1);
        }

        console.log(`Using Test User: ${user.email}`);

        const tenantId = user.tenantId || user.ownedTenantIds[0];
        console.log(`Using Tenant ID: ${tenantId}`);

        // Login to get token
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: user.email,
            password: 'password123', // Assuming standard test password
        });
        const token = loginRes.data.data.token;

        const headers = { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId.toString() };

        // Test Razorpay Checkout
        console.log('\n--- Testing Razorpay Checkout ---');
        try {
            const rzpRes = await axios.post(`${API_URL}/billing/subscribe`, {
                planSlug: 'professional',
                billingCycle: 'monthly',
                provider: 'razorpay'
            }, { headers });

            console.log('✅ Razorpay Order Created:');
            console.log(rzpRes.data.data);
        } catch (err) {
            console.log('❌ Razorpay failed:', err.response?.data || err.message);
        }

        // Test Stripe Checkout
        console.log('\n--- Testing Stripe Checkout ---');
        try {
            const stripeRes = await axios.post(`${API_URL}/billing/subscribe`, {
                planSlug: 'professional',
                billingCycle: 'monthly',
                provider: 'stripe'
            }, { headers });

            console.log('✅ Stripe Session Created:');
            console.log(stripeRes.data.data);
            console.log('URL to visit:', stripeRes.data.data.sessionUrl);
        } catch (err) {
            console.log('❌ Stripe failed:', err.response?.data || err.message);
        }

    } catch (error) {
        console.error('Fatal Error:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
