const mongoose = require('mongoose');
const { connectDB, env } = require('../libs/shared-config/src');
require('../apps/tenant-service/src/models/Plan'); // Ensure Plan model is registered
const Tenant = require('../apps/tenant-service/src/models/Tenant');

async function main() {
    await connectDB(env.MONGO.TENANT, 'check-tenant');
    const email = 'krrish.macwan@gmail.com'; // Adjust if different
    const tenant = await Tenant.findOne({ email }).populate('planId');
    if (!tenant) {
        console.log('Tenant not found');
    } else {
        console.log('Tenant Status:', tenant.status);
        console.log('Trial Status:', tenant.trialStatus);
        console.log('Plan Name:', tenant.planId?.name);
        console.log('Plan Features:', tenant.planId?.features);
    }
    await mongoose.disconnect();
    process.exit(0);
}

main().catch(console.error);
