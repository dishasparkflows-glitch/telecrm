/**
 * Event names used for inter-service communication via Redis Pub/Sub
 */
const EVENTS = {
    // Tenant events
    TENANT_REGISTERED: 'tenant.registered',
    TENANT_UPGRADED: 'tenant.upgraded',
    TENANT_SUSPENDED: 'tenant.suspended',
    TENANT_TRIAL_EXPIRING: 'tenant.trial.expiring',
    TENANT_TRIAL_EXPIRED: 'tenant.trial.expired',

    // Lead events
    LEAD_CREATED: 'lead.created',
    LEAD_UPDATED: 'lead.updated',
    LEAD_ASSIGNED: 'lead.assigned',
    LEAD_STAGE_CHANGED: 'lead.stage.changed',
    LEAD_CONVERTED: 'lead.converted',
    LEAD_SCORE_UPDATED: 'lead.score.updated',
    LEAD_FOLLOWUP_SCHEDULED: 'lead.followup.scheduled',

    // Call events
    CALL_INITIATED: 'call.initiated',
    CALL_COMPLETED: 'call.completed',
    CALL_MISSED: 'call.missed',

    // WhatsApp events
    WHATSAPP_MESSAGE_SENT: 'whatsapp.message.sent',
    WHATSAPP_MESSAGE_RECEIVED: 'whatsapp.message.received',
    WHATSAPP_BROADCAST_COMPLETED: 'whatsapp.broadcast.completed',
    WHATSAPP_WELCOME_REQUESTED: 'whatsapp.welcome.requested',

    // Automation events
    AUTOMATION_TRIGGERED: 'automation.triggered',
    AUTOMATION_ACTION_COMPLETED: 'automation.action.completed',

    // Billing events
    PLAN_UPGRADED: 'billing.plan.upgraded',
    PLAN_DOWNGRADED: 'billing.plan.downgraded',
    FEATURE_PURCHASED: 'billing.feature.purchased',
    FEATURE_CANCELLED: 'billing.feature.cancelled',
    PAYMENT_SUCCESS: 'billing.payment.success',
    PAYMENT_FAILED: 'billing.payment.failed',
    INVOICE_CREATED: 'billing.invoice.created',

    // Form events
    FORM_SUBMITTED: 'form.submitted',

    // Meeting events
    MEETING_BOOKED: 'meeting.booked',
    MEETING_CANCELLED: 'meeting.cancelled',
    MEETING_REMINDER: 'meeting.reminder',

    // Notification events
    SEND_NOTIFICATION: 'notification.send',
    SEND_EMAIL: 'notification.email',
    SEND_PUSH: 'notification.push',
};

module.exports = { EVENTS };
