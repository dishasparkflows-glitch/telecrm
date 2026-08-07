const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { seedPlans } = require('./seeds/planSeeder');
const { registerEventListeners } = require('./events/eventListeners');
const { registerCronJobs } = require('./jobs/cronJobs');

const PORT = env.PORTS.TENANT;
const MONGO_URI = env.MONGO.TENANT;

const startServer = async () => {
  await connectDB(MONGO_URI, 'tenant-service');

  // Seed default plans on first run
  await seedPlans();
  try { await registerEventListeners(); } catch (e) { console.warn('⚠️  Event listeners skipped (Redis unavailable):', e.message); }
  registerCronJobs();

  app.listen(PORT, () => {
    console.log(`🚀 tenant-service running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('❌ Failed to start tenant-service:', err);
  process.exit(1);
});

