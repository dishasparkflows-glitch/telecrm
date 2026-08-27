const twilio = require('twilio');
const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');

/**
 * Send SMS using Twilio
 */
const sendTwilioSms = async (to, message) => {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
        console.warn('⚠️ Twilio credentials missing in environment.');
        return { success: false, error: 'Missing Twilio credentials' };
    }
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    try {
        // Twilio requires phone numbers to be in E.164 format (+1234567890)
        const formattedTo = to.startsWith('+') ? to : `+${to}`;
        const response = await client.messages.create({
            body: message,
            from: env.TWILIO_FROM_NUMBER,
            to: formattedTo
        });
        console.log(`📱 Twilio SMS sent to ${formattedTo} (SID: ${response.sid})`);
        return { success: true, messageId: response.sid };
    } catch (err) {
        console.error('❌ Twilio SMS failed:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Send SMS using MSG91
 */
const sendMsg91Sms = async (to, message) => {
    if (!env.MSG91_AUTH_KEY || !env.MSG91_SENDER_ID || !env.MSG91_TEMPLATE_ID) {
        console.warn('⚠️ MSG91 credentials missing in environment.');
        return { success: false, error: 'Missing MSG91 credentials' };
    }
    try {
        // Strip out any non-numeric characters (like + or spaces) for MSG91
        const formattedTo = to.replace(/\D/g, '');
        const response = await axios.post('https://api.msg91.com/api/v5/flow/', {
            template_id: env.MSG91_TEMPLATE_ID,
            sender: env.MSG91_SENDER_ID,
            short_url: '1',
            mobiles: formattedTo,
            // Depending on your MSG91 DLT template configuration, 
            // you might need to map variables here, e.g., "var1": message.
            // For now, we assume a single variable payload or a direct send if configured.
            message: message 
        }, {
            headers: {
                'authkey': env.MSG91_AUTH_KEY,
                'content-type': 'application/json'
            }
        });

        if (response.data.type === 'success') {
            console.log(`📱 MSG91 SMS sent to ${formattedTo}`);
            return { success: true, messageId: response.data.message };
        } else {
            console.error('❌ MSG91 SMS failed:', response.data.message);
            return { success: false, error: response.data.message };
        }
    } catch (err) {
        console.error('❌ MSG91 SMS request failed:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Main sendSms function that routes to the chosen provider.
 * Configure the provider by setting SMS_PROVIDER to 'twilio' or 'msg91' in the .env file.
 */
const sendSms = async (to, message) => {
    // Check if in development or missing provider config
    if (!env.SMS_PROVIDER) {
        console.log(`📱 [DEV] SMS to ${to}: ${message}`);
        return { success: true, dev: true };
    }

    if (env.SMS_PROVIDER.toLowerCase() === 'twilio') {
        return sendTwilioSms(to, message);
    } else if (env.SMS_PROVIDER.toLowerCase() === 'msg91') {
        return sendMsg91Sms(to, message);
    } else {
        console.warn(`⚠️ Unsupported SMS provider: ${env.SMS_PROVIDER}`);
        return { success: false, error: 'Unsupported SMS provider' };
    }
};

module.exports = { sendSms, sendTwilioSms, sendMsg91Sms };
