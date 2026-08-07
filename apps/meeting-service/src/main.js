const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');

const PORT = env.PORTS.MEETING;
const MONGO_URI = env.MONGO.MEETING;

const startServer = async () => {
  await connectDB(MONGO_URI, 'meeting-service');

  app.listen(PORT, () => {
    console.log(' meeting-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error(' Failed to start meeting-service:', err);
  process.exit(1);
});
