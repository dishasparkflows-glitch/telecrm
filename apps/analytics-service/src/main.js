const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');

const PORT = env.PORTS.ANALYTICS;
const MONGO_URI = env.MONGO.ANALYTICS;

const startServer = async () => {
  await connectDB(MONGO_URI, 'analytics-service');

  app.listen(PORT, () => {
    console.log(' analytics-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error(' Failed to start analytics-service:', err);
  process.exit(1);
});
