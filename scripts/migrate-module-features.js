/**
 * Migration: Backfill requiredFeature on existing Module documents.
 *
 * Run once after deploying the schema changes:
 *   node scripts/migrate-module-features.js
 *
 * This updates all existing Module documents in ALL tenants to set
 * the requiredFeature field based on the module key.
 */
const mongoose = require('mongoose');
const path = require('path');

// Load env
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const FEATURE_MAP = {
    leads: 'lead_management',
    calls: 'calling_basic',
    whatsapp: 'whatsapp_session',
    whatsapp_inbox: 'whatsapp_session',
    whatsapp_broadcasts: 'whatsapp_session',
    forms: 'smart_forms',
    meetings: 'meeting_scheduler',
    automations: 'automation_basic',
    analytics: 'analytics_basic',
    // Everything else (dashboard, roles, users, modules, branches,
    //                   settings, billing, audit, notifications) → null
};

async function run() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI_TENANTS;
    if (!mongoUri) {
        console.error('MONGO_URI or MONGO_URI_TENANTS not set');
        process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Module = mongoose.model('Module', new mongoose.Schema({}, { strict: false, collection: 'modules' }));

    // Set requiredFeature for known keys
    for (const [key, feature] of Object.entries(FEATURE_MAP)) {
        const result = await Module.updateMany(
            { key, $or: [{ requiredFeature: { $exists: false } }, { requiredFeature: null }] },
            { $set: { requiredFeature: feature } }
        );
        if (result.modifiedCount > 0) {
            console.log(`  ✅ ${key} → ${feature} (${result.modifiedCount} updated)`);
        }
    }

    // Set null for all other modules that don't have requiredFeature yet
    const nullResult = await Module.updateMany(
        { key: { $nin: Object.keys(FEATURE_MAP) }, requiredFeature: { $exists: false } },
        { $set: { requiredFeature: null } }
    );
    if (nullResult.modifiedCount > 0) {
        console.log(`  ✅ Others → null (${nullResult.modifiedCount} updated)`);
    }

    // Summary
    const total = await Module.countDocuments({});
    const withFeature = await Module.countDocuments({ requiredFeature: { $ne: null } });
    console.log(`\nDone. ${total} modules total, ${withFeature} with requiredFeature set.`);

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
