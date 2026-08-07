const mongoose = require('mongoose');
const { requiredEnvList } = require('./_safety');

const URI_ENV_NAMES = [
    'MONGO_URI_AUTH',
    'MONGO_URI_TENANTS',
    'MONGO_URI_LEADS',
    'MONGO_URI_CALLS',
    'MONGO_URI_WHATSAPP',
    'MONGO_URI_AUTOMATIONS',
    'MONGO_URI_ANALYTICS',
    'MONGO_URI_BILLING',
    'MONGO_URI_NOTIFICATIONS',
    'MONGO_URI_FORMS',
    'MONGO_URI_MEETINGS',
];
const URIs = Object.values(requiredEnvList(URI_ENV_NAMES));

async function clearDatabase(uri) {
    try {
        const conn = await mongoose.createConnection(uri).asPromise();
        console.log(`Connected to: ${conn.name}`);

        const collections = await conn.db.listCollections().toArray();
        let cleared = 0;

        for (let coll of collections) {
            // Drop everything
            await conn.db.collection(coll.name).drop();
            cleared++;
        }

        console.log(`✅ Cleared ${cleared} collections in ${conn.name}`);
        await conn.close();
    } catch (err) {
        console.error(`❌ Error clearing ${uri.split('/').pop()}:`, err.message);
    }
}



async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   SparkCRM Data Reset & Seed Script                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    console.log('\n🧹 Clearing all databases...');
    for (const uri of URIs) {
        await clearDatabase(uri);
    }

    console.log('\n⚠️ Databases cleared! Now start the backend using: npm run dev:backend');
    console.log('⚠️ Wait for the backend to fully start before continuing.');

    // We'll pause here and let the user (or next tool call) run the backend and then the registration
}

main().catch(console.error);
