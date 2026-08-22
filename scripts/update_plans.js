const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

async function run() {
    console.log('Connecting to MongoDB...', process.env.MONGO_URI_TENANTS);
    await mongoose.connect(process.env.MONGO_URI_TENANTS);
    console.log('Connected.');
    
    await mongoose.connection.collection('plans').updateMany(
        { moduleKeys: 'meetings' }, 
        { $addToSet: { moduleKeys: 'calendar' } }
    );
    console.log('Updated plans.');
    
    // Also update tenants' extraModuleKeys if they have custom subscriptions
    const tenants = await mongoose.connection.collection('tenants').find().toArray();
    for (const t of tenants) {
        if (t.extraModuleKeys && t.extraModuleKeys.includes('meetings') && !t.extraModuleKeys.includes('calendar')) {
            await mongoose.connection.collection('tenants').updateOne(
                { _id: t._id },
                { $push: { extraModuleKeys: 'calendar' } }
            );
        }
    }
    
    await mongoose.disconnect();
    console.log('Done.');
}
run();
