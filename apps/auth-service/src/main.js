const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');

const PORT = env.PORTS.AUTH;
const MONGO_URI = env.MONGO.AUTH;

const startServer = async () => {
  await connectDB(MONGO_URI, 'auth-service');

  app.listen(PORT, () => {
    console.log(' auth-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error(' Failed to start auth-service:', err);
  process.exit(1);
});
