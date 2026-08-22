require('dotenv').config({ path: 'd:/SparkCRM/.env' });
const mongoose = require('mongoose');

async function dropIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sparkcrm');
        console.log('Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const collection = db.collection('reminders');
        
        try {
            await collection.dropIndex('tenantId_1_leadId_1_type_1');
            console.log('Successfully dropped old index: tenantId_1_leadId_1_type_1');
        } catch (err) {
            console.log('Index drop failed (it might not exist):', err.message);
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    }
}

dropIndex();
