const { env } = require('@sparkcrm/shared-config');
const app = require('./app');

const PORT = env.PORTS.UPLOAD || process.env.PORT || 8012;

app.listen(PORT, () => {
    console.log(`🚀 Upload Service running on port ${PORT}`);
});
