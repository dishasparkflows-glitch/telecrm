const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { seedFeatures } = require('./seeds/featureSeeder');
const { startBillingJobs } = require('./services/billingJobs.service');

const PORT = env.PORTS.BILLING;
const MONGO_URI = env.MONGO.BILLING;

const startServer = async () => {
  await connectDB(MONGO_URI, 'billing-service');

  // Seed features on first run
  await seedFeatures();
  startBillingJobs();

  app.listen(PORT, () => {
    console.log(`🚀 billing-service running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('❌ Failed to start billing-service:', err);
  process.exit(1);
});
