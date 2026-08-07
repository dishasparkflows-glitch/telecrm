const { server } = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { restoreAllSessions } = require('./services/baileysSession.service');
const { registerEventListeners } = require('./events/eventListeners');
const { registerOutboundQueueJob } = require('./services/outboundQueue.service');
const { registerMessageEventRetryJob } = require('./services/messageEvents.service');
const { ensureMessageIndexes } = require('./services/messageIndex.service');

// Get the io instance from app.js
const { io } = require('./app');

const PORT      = env.PORTS.WHATSAPP;
const MONGO_URI = env.MONGO.WHATSAPP;

const startServer = async () => {
    await connectDB(MONGO_URI, 'whatsapp-service');
    await ensureMessageIndexes();
    await registerEventListeners();
    registerOutboundQueueJob();
    registerMessageEventRetryJob();

    server.listen(PORT, async () => {
        console.log(' whatsapp-service running on port ' + PORT);
        // Auto-reconnect any agents who had active sessions before restart
        await restoreAllSessions(io).catch(err =>
            console.error('❌ Session restore failed:', err.message)
        );
    });
};

startServer().catch((err) => {
    console.error(' Failed to start whatsapp-service:', err);
    process.exit(1);
});
