const app = require('./app');
const { env } = require('@sparkcrm/shared-config');
const { initializeSocket } = require('./socket/socket.server');

const PORT = env.PORTS.GATEWAY;

const server = app.listen(PORT, () => {
    console.log(`\n🚀 ═══════════════════════════════════════════`);
    console.log(`   SparkCRM API Gateway`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`═══════════════════════════════════════════════\n`);
});

initializeSocket(server);
