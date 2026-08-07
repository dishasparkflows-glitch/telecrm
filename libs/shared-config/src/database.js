const mongoose = require('mongoose');

/**
 * Connect to MongoDB for a specific service
 * @param {string} uri - MongoDB connection URI
 * @param {string} serviceName - Name of the service (for logging)
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async (uri, serviceName = 'service') => {
  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ [${serviceName}] MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`❌ [${serviceName}] MongoDB error:`, err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn(`⚠️ [${serviceName}] MongoDB disconnected`);
    });

    return conn;
  } catch (error) {
    console.error(`❌ [${serviceName}] MongoDB connection failed:`, error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
