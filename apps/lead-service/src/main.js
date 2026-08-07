const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { registerEventListeners } = require('./events/eventListeners');
const { registerCronJobs } = require('./jobs/cronJobs');
const { registerMetaInboundWorker } = require('./workers/metaInbound.worker');
const { registerMetaConnectionHealthWorker } = require('./workers/metaConnectionHealth.worker');

const PORT = env.PORTS.LEAD;
const MONGO_URI = env.MONGO.LEAD;

const startServer = async () => {
  await connectDB(MONGO_URI, 'lead-service');
  try { await registerEventListeners(); } catch (e) { console.warn('⚠️  Event listeners skipped (Redis unavailable):', e.message); }
  registerCronJobs();
  registerMetaInboundWorker();
  registerMetaConnectionHealthWorker();

  app.listen(PORT, () => {
    console.log('🚀 lead-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error('❌ Failed to start lead-service:', err);
  process.exit(1);
});

