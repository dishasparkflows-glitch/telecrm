const mongoose = require('mongoose');
const { requiredEnv } = require('./_safety');

const MONGO_URI_TENANTS = requiredEnv('MONGO_URI_TENANTS');

async function run() {
    try {
        await mongoose.connect(MONGO_URI_TENANTS);
        console.log('Connected to MongoDB');

        const Tenant = mongoose.connection.collection('tenants');
        const Module = mongoose.connection.collection('modules');

        const tenants = await Tenant.find({}).toArray();
        console.log(`Found ${tenants.length} tenants`);

        for (const tenant of tenants) {
            const tenantId = tenant._id;
            console.log(`Processing tenant: ${tenant.name} (${tenantId})`);

            // Check if module already exists
            const existing = await Module.findOne({ tenantId, key: 'whatsapp_broadcasts' });
            if (existing) {
                console.log(`  Module whatsapp_broadcasts already exists for ${tenant.name}`);
                continue;
            }

            // Insert module
            const newModule = {
                tenantId,
                key: 'whatsapp_broadcasts',
                label: 'Broadcasts',
                icon: 'Megaphone',
                path: '/whatsapp/broadcasts',
                parentKey: 'whatsapp',
                section: 'MENU',
                order: 5,
                isSystem: true,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await Module.insertOne(newModule);
            console.log(`  Added whatsapp_broadcasts module for ${tenant.name}`);

            // Increment orders of subsequent modules
            await Module.updateMany(
                { tenantId, section: 'MENU', order: { $gte: 6 }, key: { $ne: 'whatsapp_broadcasts' } },
                { $inc: { order: 1 } }
            );
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
