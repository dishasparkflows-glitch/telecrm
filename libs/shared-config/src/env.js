const path = require('path');
const fs = require('fs');

// Find .env from CWD upward (handles services running from apps/*/)
const findEnvFile = () => {
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        const envPath = path.join(dir, '.env');
        if (fs.existsSync(envPath)) return envPath;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return undefined; // dotenv will use default behavior
};

require('dotenv').config({ path: findEnvFile() });

const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    isDev: (process.env.NODE_ENV || 'development') === 'development',
    isProd: process.env.NODE_ENV === 'production',

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'sparkcrm_dev_jwt_secret_2026',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'sparkcrm_dev_refresh_secret_2026',
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET || '',

    // Encryption (Fallback key for dev: 32 bytes hex)
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'd0f8a845f94a8c9b36d07817eb6a5f78a2307bdc83321591f893de33b1e8469c',

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    // Service Ports
    PORTS: {
        GATEWAY: parseInt(process.env.PORT_GATEWAY || '8000', 10),
        AUTH: parseInt(process.env.PORT_AUTH || '8001', 10),
        TENANT: parseInt(process.env.PORT_TENANT || '8002', 10),
        LEAD: parseInt(process.env.PORT_LEAD || '8003', 10),
        CALL: parseInt(process.env.PORT_CALL || '8004', 10),
        WHATSAPP: parseInt(process.env.PORT_WHATSAPP || '8005', 10),
        AUTOMATION: parseInt(process.env.PORT_AUTOMATION || '8006', 10),
        ANALYTICS: parseInt(process.env.PORT_ANALYTICS || '8007', 10),
        BILLING: parseInt(process.env.PORT_BILLING || '8008', 10),
        NOTIFICATION: parseInt(process.env.PORT_NOTIFICATION || '8009', 10),
        FORM: parseInt(process.env.PORT_FORM || '8010', 10),
        MEETING: parseInt(process.env.PORT_MEETING || '8011', 10),
        UPLOAD: parseInt(process.env.PORT_UPLOAD || '8012', 10),
        INTEGRATION: parseInt(process.env.PORT_INTEGRATION || '8013', 10),
    },

    // Service URLs (for gateway proxy)
    SERVICES: {
        AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:8001',
        TENANT: process.env.TENANT_SERVICE_URL || 'http://localhost:8002',
        LEAD: process.env.LEAD_SERVICE_URL || 'http://localhost:8003',
        CALL: process.env.CALL_SERVICE_URL || 'http://localhost:8004',
        WHATSAPP: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8005',
        AUTOMATION: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:8006',
        ANALYTICS: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8007',
        BILLING: process.env.BILLING_SERVICE_URL || 'http://localhost:8008',
        NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8009',
        FORM: process.env.FORM_SERVICE_URL || 'http://localhost:8010',
        MEETING: process.env.MEETING_SERVICE_URL || 'http://localhost:8011',
        UPLOAD: process.env.UPLOAD_SERVICE_URL || 'http://localhost:8012',
        INTEGRATION: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:8013',
    },

    // MongoDB URIs
    MONGO: {
        AUTH: process.env.MONGO_URI_AUTH || 'mongodb://localhost:27017/sparkcrm_auth',
        TENANT: process.env.MONGO_URI_TENANTS || 'mongodb://localhost:27017/sparkcrm_tenants',
        LEAD: process.env.MONGO_URI_LEADS || 'mongodb://localhost:27017/sparkcrm_leads',
        CALL: process.env.MONGO_URI_CALLS || 'mongodb://localhost:27017/sparkcrm_calls',
        WHATSAPP: process.env.MONGO_URI_WHATSAPP || 'mongodb://localhost:27017/sparkcrm_whatsapp',
        AUTOMATION: process.env.MONGO_URI_AUTOMATIONS || 'mongodb://localhost:27017/sparkcrm_automations',
        ANALYTICS: process.env.MONGO_URI_ANALYTICS || 'mongodb://localhost:27017/sparkcrm_analytics',
        BILLING: process.env.MONGO_URI_BILLING || 'mongodb://localhost:27017/sparkcrm_billing',
        NOTIFICATION: process.env.MONGO_URI_NOTIFICATIONS || 'mongodb://localhost:27017/sparkcrm_notifications',
        FORM: process.env.MONGO_URI_FORMS || 'mongodb://localhost:27017/sparkcrm_forms',
        MEETING: process.env.MONGO_URI_MEETINGS || 'mongodb://localhost:27017/sparkcrm_meetings',
        INTEGRATION: process.env.MONGO_URI_INTEGRATIONS || 'mongodb://localhost:27017/sparkcrm_integrations',
    },

    // External APIs
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',

    EXOTEL_SID: process.env.EXOTEL_SID || '',
    EXOTEL_TOKEN: process.env.EXOTEL_TOKEN || '',
    EXOTEL_CALLBACK_URL: process.env.EXOTEL_CALLBACK_URL || '',

    TWILIO_VOICE_WEBHOOK_URL: process.env.TWILIO_VOICE_WEBHOOK_URL || '',

    WABA_API_URL: process.env.WABA_API_URL || 'https://graph.facebook.com/v17.0',
    WABA_TOKEN: process.env.WABA_TOKEN || '',
    WABA_PHONE_NUMBER_ID: process.env.WABA_PHONE_NUMBER_ID || '',
    WABA_WEBHOOK_VERIFY_TOKEN: process.env.WABA_WEBHOOK_VERIFY_TOKEN || '',
    WABA_APP_SECRET: process.env.WABA_APP_SECRET || '',

    // SMTP / Email
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || '',
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'SparkCRM',

    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'sparkcrm-uploads',
    AWS_REGION: process.env.AWS_REGION || 'ap-south-1',

    // Cloudflare R2
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_ACCESS_KEY_ID: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
    CLOUDFLARE_ACCESS_KEY: process.env.CLOUDFLARE_ACCESS_KEY || '',
    CLOUDFLARE_TOKEN_VALUE: process.env.CLOUDFLARE_TOKEN_VALUE || '',
    CLOUDFLARE_ENDPOINT: process.env.CLOUDFLARE_ENDPOINT || '',
    CLOUDFLARE_URL: process.env.CLOUDFLARE_URL || '',
    CLOUDFLARE_BUCKET_NAME: process.env.CLOUDFLARE_BUCKET_NAME || '',
    CLOUDFLARE_REGION: process.env.CLOUDFLARE_REGION || 'auto',

    // Frontend
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5174',
};

if (env.isProd) {
    const requiredSecrets = [
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'INTERNAL_SERVICE_SECRET',
        'ENCRYPTION_KEY',
        'REDIS_URL',
    ];
    const missingSecrets = requiredSecrets.filter((key) => !process.env[key]);
    if (missingSecrets.length > 0) {
        throw new Error(`Missing required production secrets: ${missingSecrets.join(', ')}`);
    }
    if (process.env.INTERNAL_SERVICE_SECRET.length < 32) {
        throw new Error('INTERNAL_SERVICE_SECRET must contain at least 32 characters in production');
    }
    if (!/^[a-f\d]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hexadecimal value in production');
    }
}

module.exports = { env };
