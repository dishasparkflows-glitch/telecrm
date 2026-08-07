const app = require('./app');
const { env } = require('@sparkcrm/shared-config');
const { attachWebSocketUpgrades } = require('./proxy/serviceProxy');

const PORT = env.PORTS.GATEWAY;

const server = app.listen(PORT, () => {
    console.log(`\n🚀 ═══════════════════════════════════════════`);
    console.log(`   SparkCRM API Gateway`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`═══════════════════════════════════════════════\n`);
});

attachWebSocketUpgrades(server);
