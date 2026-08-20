const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');

const PORT = env.PORTS.INTEGRATION || 8013;
const MONGO_URI = env.MONGO.INTEGRATION;

const startServer = async () => {
    await connectDB(MONGO_URI, 'integration-service');

    app.listen(PORT, () => {
        console.log(' integration-service running on port ' + PORT);
    });
};

startServer().catch((err) => {
    console.error(' Failed to start integration-service:', err);
    process.exit(1);
});
