const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');

const PORT = env.PORTS.FORM;
const MONGO_URI = env.MONGO.FORM;

const startServer = async () => {
  await connectDB(MONGO_URI, 'form-service');

  app.listen(PORT, () => {
    console.log(' form-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error(' Failed to start form-service:', err);
  process.exit(1);
});
