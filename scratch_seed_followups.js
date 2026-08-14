const mongoose = require('mongoose');

async function run() {
    await mongoose.connect('mongodb://localhost:27017/sparkcrm_tenants');
    const Module = require('./apps/tenant-service/src/models/Module');
    const Tenant = require('./apps/tenant-service/src/models/Tenant');
    
    const tenants = await Tenant.find();
    for (const t of tenants) {
        await Module.updateOne(
            { tenantId: t._id, key: 'followups' },
            { 
                $set: { 
                    label: 'Follow-ups', 
                    icon: 'CalendarDays', 
                    path: '/follow-ups', 
                    section: 'MENU', 
                    order: 1.5, 
                    isSystem: true, 
                    isActive: true, 
                    requiredFeature: 'lead_management' 
                } 
            }, 
            { upsert: true }
        );
    }
    console.log('Follow-ups module seeded successfully.');
    process.exit(0);
}

run().catch(console.error);
