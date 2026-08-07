/**
 * Diagnostic: Check PaymentConfig in DB and test decryption
 */
const mongoose = require('mongoose');
const { env } = require('../libs/shared-config/src/env');
const { decrypt } = require('../libs/shared-utils/src/crypto');
const PaymentConfig = require('../apps/billing-service/src/models/PaymentConfig');

async function run() {
    console.log('Connecting to billing DB...');
    await mongoose.connect(env.MONGO.BILLING);
    console.log('✅ Connected\n');

    try {
        // 1. Check if Razorpay config exists
        const config = await PaymentConfig.findOne({ provider: 'razorpay' });

        if (!config) {
            console.error('❌ No Razorpay PaymentConfig found in DB!');
            console.log('   The owner needs to configure Razorpay in Settings → Payment first.');
            return;
        }

        console.log('=== Razorpay PaymentConfig ===');
        console.log('Provider:', config.provider);
        console.log('isActive:', config.isActive);
        console.log('DisplayName:', config.displayName);
        console.log('');

        // Check what credential keys are stored
        const credKeys = config.credentials ? [...config.credentials.keys()] : [];
        console.log('Stored credential keys:', credKeys);
        console.log('');

        // Check isDev
        const isDev = process.env.NODE_ENV === 'development';
        console.log('NODE_ENV:', process.env.NODE_ENV || '(not set => defaults to development)');
        console.log('isDev:', isDev || process.env.NODE_ENV === undefined);
        console.log('');

        // 2. Show what billing.controller.js would try to read
        const testKeyId = config.credentials?.get('testKeyId');
        const keyId = config.credentials?.get('keyId');
        const testKeySecret = config.credentials?.get('testKeySecret');
        const keySecret = config.credentials?.get('keySecret');

        console.log('=== Raw Encrypted Values ===');
        console.log('testKeyId:     ', testKeyId ? (testKeyId.substring(0, 40) + '...') : '(not set)');
        console.log('keyId:         ', keyId ? (keyId.substring(0, 40) + '...') : '(not set)');
        console.log('testKeySecret: ', testKeySecret ? (testKeySecret.substring(0, 40) + '...') : '(not set)');
        console.log('keySecret:     ', keySecret ? (keySecret.substring(0, 40) + '...') : '(not set)');
        console.log('');

        // 3. Simulate what billing controller does in dev mode
        const rzpKeyIdRaw = testKeyId || keyId;
        const rzpSecretRaw = testKeySecret || keySecret;

        console.log('=== Resolution (dev mode) ===');
        console.log('Resolved keyId source:', testKeyId ? 'testKeyId' : keyId ? 'keyId' : '(NONE!)');
        console.log('Resolved secret source:', testKeySecret ? 'testKeySecret' : keySecret ? 'keySecret' : '(NONE!)');
        console.log('');

        if (!rzpKeyIdRaw) {
            console.error('❌ No keyId found! Neither testKeyId nor keyId are stored.');
            return;
        }
        if (!rzpSecretRaw) {
            console.error('❌ No keySecret found! Neither testKeySecret nor keySecret are stored.');
            return;
        }

        // 4. Try to decrypt
        console.log('=== Decryption Test ===');
        try {
            const decryptedKeyId = decrypt(rzpKeyIdRaw);
            console.log('✅ Decrypted keyId:', decryptedKeyId);

            if (!decryptedKeyId.startsWith('rzp_test_') && !decryptedKeyId.startsWith('rzp_live_')) {
                console.warn('⚠️  Key ID does not start with rzp_test_ or rzp_live_ — might be invalid!');
            }
        } catch (err) {
            console.error('❌ Failed to decrypt keyId:', err.message);
        }

        try {
            const decryptedSecret = decrypt(rzpSecretRaw);
            console.log('✅ Decrypted keySecret:', decryptedSecret.substring(0, 6) + '***' + decryptedSecret.substring(decryptedSecret.length - 4));
            console.log('   Secret length:', decryptedSecret.length);
        } catch (err) {
            console.error('❌ Failed to decrypt keySecret:', err.message);
        }

    } catch (error) {
        console.error('Script error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\nDone.');
    }
}

run();
