/**
 * SparkCRM Email Templates
 * Rich branded HTML templates for all email types
 */

const BRAND = {
    name: 'SparkCRM',
    color: '#6C47FF',
    logo: '⚡',
    website: 'https://sparkcrm.com',
    support: 'support@sparkcrm.com',
};

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeTemplateData = (data = {}) => Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined) return [key, value];
        if (Array.isArray(value)) {
            return [key, value.map((item) => (
                item && typeof item === 'object' ? sanitizeTemplateData(item) : escapeHtml(item)
            ))];
        }
        if (typeof value === 'object') return [key, sanitizeTemplateData(value)];
        if (/url$/i.test(key)) {
            try {
                const url = new URL(String(value));
                return [key, url.protocol === 'https:' ? escapeHtml(url.toString()) : '#'];
            } catch {
                return [key, '#'];
            }
        }
        return [key, typeof value === 'string' ? escapeHtml(value) : value];
    })
);

// ─── Base wrapper ───
const wrapTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SparkCRM</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<!-- Header -->
<tr><td style="background:linear-gradient(135deg,${BRAND.color},#4f2de0);padding:28px 32px;text-align:center;">
<span style="font-size:28px;font-weight:800;color:#fff;">${BRAND.logo} ${BRAND.name}</span>
</td></tr>
<!-- Content -->
<tr><td style="padding:32px;">${content}</td></tr>
<!-- Footer -->
<tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</p>
<p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">
<a href="${BRAND.website}" style="color:${BRAND.color};text-decoration:none;">Visit Website</a> · 
<a href="mailto:${BRAND.support}" style="color:${BRAND.color};text-decoration:none;">Contact Support</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

// ─── OTP Template ───
const otpTemplate = (data) => {
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Verify Your Account</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.5;">Use this OTP to verify your email address. This code is valid for <strong>10 minutes</strong>.</p>
    <div style="background:#f3f0ff;border:2px dashed ${BRAND.color};border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
        <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:${BRAND.color};">${data.otp}</span>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;line-height:1.5;">If you didn't request this code, you can safely ignore this email. Do not share this code with anyone.</p>`;
    return { subject: `🔐 Your SparkCRM Verification Code: ${data.otp}`, html: wrapTemplate(html) };
};

// ─── Welcome Registration Template ───
const welcomeTemplate = (data) => {
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Welcome to SparkCRM! 🎉</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.5;">
        Thank you for choosing SparkCRM. Your account has been created successfully.
    </p>
    <div style="background:#f9fafb;border-radius:10px;padding:20px;margin:0 0 20px;">
        <h3 style="font-size:14px;color:#111827;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Account Details</h3>
        <table style="width:100%;font-size:14px;color:#374151;" cellspacing="0" cellpadding="4">
            <tr><td style="color:#6b7280;width:140px;">Company:</td><td style="font-weight:600;">${data.companyName}</td></tr>
            <tr><td style="color:#6b7280;">Email:</td><td>${data.email}</td></tr>
            <tr><td style="color:#6b7280;">Phone:</td><td>${data.phone || 'N/A'}</td></tr>
            <tr><td style="color:#6b7280;">Plan:</td><td><span style="background:${BRAND.color};color:#fff;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:600;">${data.planName || 'Free Trial'}</span></td></tr>
            <tr><td style="color:#6b7280;">Trial Ends:</td><td style="font-weight:600;color:#f59e0b;">${data.trialExpiresAt || '30 days from now'}</td></tr>
        </table>
    </div>
    <div style="text-align:center;margin:24px 0;">
        <a href="${BRAND.website}/login" style="display:inline-block;background:${BRAND.color};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Go to Dashboard →</a>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;text-align:center;">Need help? Reply to this email or contact ${BRAND.support}</p>`;
    return { subject: '🚀 Welcome to SparkCRM — Your Account is Ready!', html: wrapTemplate(html) };
};

// ─── Trial Invoice Template ───
const trialInvoiceTemplate = (data) => {
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Trial Invoice</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Here is your invoice for the free trial activation.</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin:0 0 20px;">
        <table style="width:100%;font-size:14px;color:#374151;" cellspacing="0" cellpadding="6">
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Invoice #:</td><td style="font-weight:600;text-align:right;">${data.invoiceNumber}</td></tr>
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Company:</td><td style="text-align:right;">${data.companyName}</td></tr>
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Plan:</td><td style="text-align:right;">${data.planName}</td></tr>
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Period:</td><td style="text-align:right;">${data.periodStart} — ${data.periodEnd}</td></tr>
            <tr><td style="font-weight:700;font-size:16px;">Total Amount:</td>
                <td style="text-align:right;font-weight:800;font-size:18px;color:#22c55e;">₹0 (Free Trial)</td>
            </tr>
        </table>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;">Your trial includes all ${data.planName} features for 30 days. No payment will be charged.</p>`;
    return { subject: `📄 SparkCRM Invoice #${data.invoiceNumber} — Free Trial`, html: wrapTemplate(html) };
};

// ─── Paid Invoice Template ───
const paidInvoiceTemplate = (data) => {
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Payment Invoice</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Thank you for your payment. Here is your invoice.</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin:0 0 20px;">
        <table style="width:100%;font-size:14px;color:#374151;" cellspacing="0" cellpadding="6">
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Invoice #:</td><td style="font-weight:600;text-align:right;">${data.invoiceNumber}</td></tr>
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Company:</td><td style="text-align:right;">${data.companyName}</td></tr>
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Plan:</td><td style="text-align:right;">${data.planName} (${data.billingCycle})</td></tr>
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Period:</td><td style="text-align:right;">${data.periodStart} — ${data.periodEnd}</td></tr>
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="color:#6b7280;">Payment Method:</td><td style="text-align:right;">${data.method || 'Online'}</td></tr>
            <tr><td style="font-weight:700;font-size:16px;">Total Paid:</td>
                <td style="text-align:right;font-weight:800;font-size:18px;color:${BRAND.color};">₹${(data.amount || 0).toLocaleString('en-IN')}</td>
            </tr>
        </table>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;">This is an auto-generated invoice. For queries, contact ${BRAND.support}</p>`;
    return { subject: `📄 SparkCRM Invoice #${data.invoiceNumber} — ₹${(data.amount || 0).toLocaleString('en-IN')}`, html: wrapTemplate(html) };
};

// ─── Trial Expiring Template ───
const trialExpiringTemplate = (data) => {
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Your Trial is Ending Soon ⚠️</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.5;">
        You have <strong style="color:#f59e0b;">${data.daysLeft || 3} days</strong> remaining in your free trial. Upgrade now to keep all Pro features.
    </p>
    <div style="text-align:center;margin:24px 0;">
        <a href="${BRAND.website}/billing" style="display:inline-block;background:${BRAND.color};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Upgrade Now →</a>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;text-align:center;">After the trial ends, your account will be downgraded to the Free plan.</p>`;
    return { subject: `⚠️ ${data.daysLeft || 3} days left in your SparkCRM trial`, html: wrapTemplate(html) };
};

// ─── Trial Expired Template ───
const trialExpiredTemplate = (data) => {
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Your Trial Has Ended</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.5;">
        Your 30-day free trial for <strong>${data.companyName || BRAND.name}</strong> has expired. Your account has been downgraded to the Free plan.
    </p>
    <div style="text-align:center;margin:24px 0;">
        <a href="${BRAND.website}/billing" style="display:inline-block;background:${BRAND.color};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Upgrade to Pro →</a>
    </div>`;
    return { subject: 'Your SparkCRM trial has ended — Upgrade to continue', html: wrapTemplate(html) };
};

// ─── Password Reset Template ───
const passwordResetTemplate = (data) => {
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Reset Your Password</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.5;">Click the button below to reset your password. This link is valid for <strong>1 hour</strong>.</p>
    <div style="text-align:center;margin:24px 0;">
        <a href="${data.resetUrl || '#'}" style="display:inline-block;background:${BRAND.color};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Reset Password →</a>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0;">If you didn't request this, you can safely ignore this email.</p>`;
    return { subject: '🔑 Reset Your SparkCRM Password', html: wrapTemplate(html) };
};

// ─── Meeting Invite Template ───
const meetingInviteTemplate = (data) => {
    let dateStr = 'TBD';
    let timeStr = '';
    if (data.scheduledAt) {
        const scheduledDate = new Date(data.scheduledAt);
        dateStr = scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    }
    
    const html = `
    <h1 style="font-size:22px;color:#111827;margin:0 0 8px;">Meeting Invitation</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;line-height:1.5;">
        You have been invited to a meeting. Please find the details below.
    </p>
    <div style="background:#f9fafb;border-radius:10px;padding:20px;margin:0 0 20px;border:1px solid #e5e7eb;">
        <table style="width:100%;font-size:14px;color:#374151;" cellspacing="0" cellpadding="6">
            <tr><td style="color:#6b7280;width:100px;font-weight:500;">Title:</td><td style="font-weight:600;color:#111827;">${data.meetingTitle || 'Scheduled Meeting'}</td></tr>
            <tr><td style="color:#6b7280;font-weight:500;">Date:</td><td>${dateStr}</td></tr>
            <tr><td style="color:#6b7280;font-weight:500;">Time:</td><td>${timeStr}</td></tr>
            ${data.duration ? `<tr><td style="color:#6b7280;font-weight:500;">Duration:</td><td>${data.duration} minutes</td></tr>` : ''}
        </table>
    </div>
    ${data.meetingUrl && data.meetingUrl !== '#' ? `
    <div style="text-align:center;margin:24px 0;">
        <a href="${data.meetingUrl}" style="display:inline-block;background:${BRAND.color};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Join Meeting →</a>
        <p style="margin-top:12px;font-size:12px;color:#9ca3af;">Or copy this link: <br/><a href="${data.meetingUrl}" style="color:${BRAND.color};word-break:break-all;">${data.meetingUrl}</a></p>
    </div>` : `
    <div style="text-align:center;margin:24px 0;">
        <p style="font-size:14px;color:#6b7280;font-style:italic;">No link provided. Location or conference details will be shared separately.</p>
    </div>`}
    <p style="color:#9ca3af;font-size:13px;margin:0;text-align:center;">Looking forward to seeing you there!</p>`;
    return { subject: `Invitation: ${data.meetingTitle || 'Meeting'} @ ${dateStr} ${timeStr}`, html: wrapTemplate(html) };
};

// ─── Template registry ───
const TEMPLATES = {
    otp: otpTemplate,
    welcome_registration: welcomeTemplate,
    welcome: welcomeTemplate,
    trial_invoice: trialInvoiceTemplate,
    paid_invoice: paidInvoiceTemplate,
    trial_expiring: trialExpiringTemplate,
    trial_expired: trialExpiredTemplate,
    password_reset: passwordResetTemplate,
    meeting_invite: meetingInviteTemplate,
};

/**
 * Get a rendered template by name
 * @param {string} name - Template name
 * @param {Object} data - Template data
 * @returns {{ subject: string, html: string } | null}
 */
const getTemplate = (name, data = {}) => {
    const templateFn = TEMPLATES[name];
    if (!templateFn) return null;
    return templateFn(sanitizeTemplateData(data));
};

module.exports = { getTemplate, TEMPLATES, wrapTemplate, sanitizeTemplateData };
