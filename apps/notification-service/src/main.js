const { server } = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { registerEventListeners } = require('./events/eventListeners');
const { registerCronJobs } = require('./jobs/cronJobs');

const PORT = env.PORTS.NOTIFICATION;
const MONGO_URI = env.MONGO.NOTIFICATION;

const startServer = async () => {
  await connectDB(MONGO_URI, 'notification-service');
  try { await registerEventListeners(); } catch (e) { console.warn('⚠️  Event listeners skipped (Redis unavailable):', e.message); }
  registerCronJobs();

  server.listen(PORT, () => {
    console.log('🚀 notification-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error('❌ Failed to start notification-service:', err);
  process.exit(1);
});

