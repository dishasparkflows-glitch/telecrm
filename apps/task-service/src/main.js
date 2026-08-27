const app = require('./app');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { registerEventListeners } = require('./events/eventListeners');

const PORT = env.PORTS.TASK;
const MONGO_URI = env.MONGO.TASK;

const startServer = async () => {
  await connectDB(MONGO_URI, 'task-service');
  try { 
      await registerEventListeners(); 
  } catch (e) { 
      console.warn('⚠️  Event listeners skipped (Redis unavailable):', e.message); 
  }

  app.listen(PORT, () => {
    console.log('🚀 task-service running on port ' + PORT);
  });
};

startServer().catch((err) => {
  console.error('❌ Failed to start task-service:', err);
  process.exit(1);
});
