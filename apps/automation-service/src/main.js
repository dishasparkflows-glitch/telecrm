const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { registerEventListeners } = require('./events/eventListeners');

const PORT = env.PORTS.AUTOMATION;
const MONGO_URI = env.MONGO.AUTOMATION;

const startServer = async () => {
  await connectDB(MONGO_URI, 'automation-service');
  try { await registerEventListeners(); } catch (e) { console.warn('⚠️  Event listeners skipped (Redis unavailable):', e.message); }

  app.listen(PORT, () => {
    console.log('🚀 automation-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error('❌ Failed to start automation-service:', err);
  process.exit(1);
});

