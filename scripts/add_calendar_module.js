const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const ModuleSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String, required: true },
    path: { type: String, required: true },
    parentKey: { type: String, default: null },
    section: { type: String, required: true },
    order: { type: Number, required: true },
    isSystem: { type: Boolean, default: false },
    requiredFeature: { type: String, default: null },
});
ModuleSchema.index({ tenantId: 1, key: 1 }, { unique: true });

async function run() {
    console.log('Connecting to MongoDB...', process.env.MONGO_URI_TENANTS);
    await mongoose.connect(process.env.MONGO_URI_TENANTS);
    console.log('Connected.');
    
    const Module = mongoose.models.Module || mongoose.model('Module', ModuleSchema);
    
    const tenants = await mongoose.connection.collection('tenants').find({}).toArray();
    console.log(`Found ${tenants.length} tenants.`);
    
    for (const t of tenants) {
        try {
            await Module.updateOne(
                { tenantId: t._id, key: 'calendar' },
                {
                    $set: {
                        label: 'Calendar',
                        icon: 'CalendarDays',
                        path: '/calendar',
                        section: 'MENU',
                        order: 7.1,
                        isSystem: true,
                        requiredFeature: 'meeting_scheduler'
                    }
                },
                { upsert: true }
            );
            console.log(`Added calendar module for tenant ${t._id}`);
            
            // Also give super-admin and others permission
            const Role = mongoose.connection.collection('roles');
            await Role.updateMany(
                { tenantId: t._id },
                {
                    $push: {
                        permissions: {
                            moduleKey: 'calendar',
                            actions: { view: true, create: true, edit: true, delete: true, export: true, upload: true, import: true, isOwn: false, isBranch: false, isGlobal: true }
                        }
                    }
                }
            );
            console.log(`Updated roles for tenant ${t._id}`);
        } catch (e) {
            console.error(e);
        }
    }
    
    await mongoose.disconnect();
    console.log('Done.');
}
run();
