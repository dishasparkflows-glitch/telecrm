const { FormSubmission, SmartForm } = require('../models/SmartForm');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

async function publishSubmission(submission, form) {
    try {
        await publishEvent(EVENTS.FORM_SUBMITTED, {
            tenantId: form.tenantId,
            branchId: form.branchId,
            formId: form._id,
            submissionId: submission._id,
            idempotencyKey: `form-submission:${submission._id}`,
            data: submission.data,
            settings: form.settings,
        });
        await FormSubmission.updateOne({ _id: submission._id }, { eventPublishedAt: new Date(), eventError: '' });
        return true;
    } catch (error) {
        await FormSubmission.updateOne({ _id: submission._id }, { eventError: String(error.message || error).slice(0, 1000) });
        return false;
    }
}

async function retryPendingSubmissions(limit = 100) {
    const pending = await FormSubmission.find({ eventPublishedAt: null }).sort({ 'meta.createdAt': 1 }).limit(limit);
    for (const submission of pending) {
        const form = await SmartForm.findOne({ _id: submission.formId, tenantId: submission.tenantId });
        if (form) await publishSubmission(submission, form);
    }
}

function registerSubmissionRetryJob() {
    const timer = setInterval(() => retryPendingSubmissions().catch((error) => {
        console.error('Form submission event retry failed:', error.message);
    }), 60_000);
    timer.unref?.();
    return timer;
}

module.exports = { publishSubmission, retryPendingSubmissions, registerSubmissionRetryJob };
