/**
 * Update Razorpay payment configuration using runtime-only credentials.
 */
const mongoose = require('mongoose');
const { connectDB, env } = require('../libs/shared-config/src');
const { encrypt } = require('../libs/shared-utils/src');
const PaymentConfig = require('../apps/billing-service/src/models/PaymentConfig');
const { assertExactConfirmation, hasFlag, requiredEnvList } = require('./_safety');

async function main() {
    if (!hasFlag('apply')) {
        throw new Error('Pass --apply to update the Razorpay configuration');
    }
    assertExactConfirmation('UPDATE_RAZORPAY_CONFIG');

    const credentials = requiredEnvList([
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
    ]);

    await connectDB(env.MONGO.BILLING, 'update-razorpay-config');

    try {
        const result = await PaymentConfig.findOneAndUpdate(
            { provider: 'razorpay' },
            {
                $set: {
                    displayName: 'Razorpay',
                    isActive: true,
                    credentials: {
                        keyId: encrypt(credentials.RAZORPAY_KEY_ID),
                        keySecret: encrypt(credentials.RAZORPAY_KEY_SECRET),
                    },
                    webhookSecret: encrypt(credentials.RAZORPAY_WEBHOOK_SECRET),
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );

        console.log(`Razorpay configuration updated; active=${result.isActive}`);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Razorpay configuration update failed:', err.message);
        process.exitCode = 1;
    });
}

module.exports = { main };
