const path = require('path');
const mongoose = require('mongoose');
const { env } = require(path.resolve(__dirname, '../libs/shared-config/src/env'));
const PaymentConfig = require(path.resolve(__dirname, '../apps/billing-service/src/models/PaymentConfig'));

(async () => {
    await mongoose.connect(env.MONGO.BILLING);

    try {
        const config = await PaymentConfig.findOne({ provider: 'razorpay' });
        if (!config) {
            console.log('No Razorpay configuration found');
            return;
        }

        const keys = [...config.credentials.keys()];
        console.log('=== PaymentConfig Diagnostic ===');
        console.log('isActive:', config.isActive);
        console.log('displayName:', config.displayName);
        console.log('Stored credential keys:', keys);
        console.log('Webhook secret configured:', Boolean(config.webhookSecret));
    } finally {
        await mongoose.disconnect();
    }
})().catch((err) => {
    console.error('Razorpay diagnostic failed:', err.message);
    process.exitCode = 1;
});
