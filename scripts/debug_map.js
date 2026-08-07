const mongoose = require('mongoose');
const { env } = require('../libs/shared-config/src/env');
const PaymentConfig = require('../apps/billing-service/src/models/PaymentConfig');

async function run() {
    await mongoose.connect(env.MONGO.BILLING);
    try {
        const leanDocs = await PaymentConfig.find({}).lean();
        for (const leanDoc of leanDocs) {
            console.log('\n--- FIND DOC:', leanDoc.provider);
            console.log('LEAN DOC CREDENTIALS:', leanDoc.credentials);
            console.log('TYPE OF:', typeof leanDoc.credentials);
            console.log('KEYS:', Object.keys(leanDoc.credentials || {}));
            if (leanDoc.credentials instanceof Map) {
                console.log('IS MAP!');
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}
run();
