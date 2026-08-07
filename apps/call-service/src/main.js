const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');

const PORT = env.PORTS.CALL;
const MONGO_URI = env.MONGO.CALL;

const startServer = async () => {
  await connectDB(MONGO_URI, 'call-service');

  app.listen(PORT, () => {
    console.log(' call-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error(' Failed to start call-service:', err);
  process.exit(1);
});
