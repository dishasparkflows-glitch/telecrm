const { sendEmail } = require('../channels/email.channel');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

const sendRawEmail = asyncHandler(async (req, res) => {
    const { to, subject, html, text } = req.body;
    
    if (!to || !subject || !html) {
        throw ApiError.badRequest('Missing required fields: to, subject, html');
    }

    const result = await sendEmail(to, subject, html);

    if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
    }

    ApiResponse.success(res, result, 'Email sent successfully');
});

module.exports = { sendRawEmail };
