const nodemailer = require('nodemailer');
const { env } = require('@sparkcrm/shared-config');
const { getTemplate } = require('../templates/emailTemplates');

// Configure SMTP transport
const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});

/**
 * Send email via SMTP (Nodemailer)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML email body
 */
const sendEmail = async (to, subject, html) => {
    if (!env.SMTP_USER || !env.SMTP_PASS) {
        console.log(`📧 [DEV] Email to ${to}: ${subject}`);
        return { success: true, dev: true };
    }

    try {
        const info = await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME || 'SparkCRM'}" <${env.SMTP_FROM_EMAIL || 'noreply@sparkcrm.com'}>`,
            to,
            subject,
            html,
        });
        console.log(`📧 Email sent to ${to}: ${subject} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('❌ Email send failed:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Send templated email using rich HTML templates
 * @param {string} to - Recipient email
 * @param {string} templateName - Template name from emailTemplates.js
 * @param {Object} data - Template data
 */
const sendTemplateEmail = async (to, templateName, data) => {
    const template = getTemplate(templateName, data);
    if (!template) {
        console.warn(`⚠️ Unknown email template: ${templateName}`);
        return { success: false, error: 'Unknown template' };
    }

    return sendEmail(to, template.subject, template.html);
};

module.exports = { sendEmail, sendTemplateEmail };
