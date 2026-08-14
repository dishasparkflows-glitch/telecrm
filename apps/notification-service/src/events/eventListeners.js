const { EVENTS, subscribeToEvents } = require('@sparkcrm/shared-events');
const Reminder = require('../models/Reminder');
const { sendInApp } = require('../channels/inApp.channel');
const { sendTemplateEmail } = require('../channels/email.channel');
const { sendPushToUser } = require('../channels/push.channel');

/**
 * Wire up event listeners for notification-service
 */
const registerEventListeners = async () => {
    console.log('📡 notification-service: Registering event listeners...');

    // ─── Generic send notification ───
    await subscribeToEvents(EVENTS.SEND_NOTIFICATION, async (_channel, data) => {
        try {
            const { tenantId, userId, title, message, type, actionUrl, actionType, branchId, channel } = data;
            await sendInApp(tenantId, userId, {
                title,
                message,
                type: type || 'info',
                actionUrl: actionUrl || '',
                actionType: actionType || '',
                branchId,
            });
            console.log(`🔔 Notification created for user ${userId}: ${title}`);
        } catch (err) {
            console.error('❌ notification.send handler error:', err.message);
        }
    });

    // ─── Email notification (template-based) ───
    await subscribeToEvents(EVENTS.SEND_EMAIL, async (_channel, data) => {
        try {
            const { to, template, data: templateData } = data;
            if (to && template) {
                await sendTemplateEmail(to, template, templateData || {});
            }
            console.log(`📧 Email sent → ${to} (template: ${template})`);
        } catch (err) {
            console.error('❌ notification.email handler error:', err.message);
        }
    });

    // ─── Tenant registered → Welcome email + Trial invoice ───
    await subscribeToEvents(EVENTS.TENANT_REGISTERED, async (_channel, data) => {
        try {
            const { companyName, email, phone, planName, trialExpiresAt, invoiceNumber } = data;
            if (!email) return;

            // Send welcome email
            await sendTemplateEmail(email, 'welcome_registration', {
                companyName,
                email,
                phone,
                planName: planName || 'Free Trial',
                trialExpiresAt: trialExpiresAt || '30 days from now',
            });

            // Send trial invoice email
            const now = new Date();
            const endDate = trialExpiresAt ? new Date(trialExpiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await sendTemplateEmail(email, 'trial_invoice', {
                companyName,
                planName: planName || 'Free Trial',
                invoiceNumber: invoiceNumber || `TRIAL-${Date.now()}`,
                periodStart: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                periodEnd: endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            });

            console.log(`🎉 Welcome + Invoice emails sent to ${email}`);
        } catch (err) {
            console.error('❌ tenant.registered email error:', err.message);
        }
    });

    // ─── Push notification (FCM) ───
    await subscribeToEvents(EVENTS.SEND_PUSH, async (_channel, data) => {
        try {
            const { tenantId, userId, title, body, data: pushData } = data;
            const result = await sendPushToUser({ tenantId, userId, title, body, data: pushData });
            console.log(`📲 Push notification delivered → user ${userId}: ${result.sent} sent, ${result.failed} failed`);
        } catch (err) {
            console.error('❌ notification.push handler error:', err.message);
        }
    });

    // ─── Lead follow-up scheduled/cancelled ───
    await subscribeToEvents(EVENTS.LEAD_FOLLOWUP_SCHEDULED, async (_channel, data) => {
        try {
            const { tenantId, branchId, leadId, assignedTo, followUpAt, leadName } = data;
            if (!followUpAt || !assignedTo) {
                await Reminder.updateOne(
                    { tenantId, leadId, type: 'lead_follow_up', status: { $in: ['pending', 'processing'] } },
                    { $set: { status: 'cancelled', processingAt: null } }
                );
                return;
            }
            await Reminder.findOneAndUpdate(
                { tenantId, leadId, type: 'lead_follow_up' },
                {
                    $set: {
                        branchId: branchId || null,
                        userId: assignedTo,
                        title: 'Lead follow-up due',
                        message: `Follow up with ${leadName || 'this lead'}`,
                        actionUrl: `/leads/${leadId}`,
                        dueAt: new Date(followUpAt),
                        status: 'pending',
                        processingAt: null,
                        sentAt: null,
                        attempts: 0,
                        lastError: '',
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (err) {
            console.error('❌ lead.followup.scheduled handler error:', err.message);
        }
    });

    // ─── Lead assigned → notify assigned user ───
    await subscribeToEvents(EVENTS.LEAD_ASSIGNED, async (_channel, data) => {
        try {
            const { tenantId, leadId, assignedTo } = data;
            await Reminder.updateMany(
                { tenantId, leadId, type: 'lead_follow_up', status: 'pending' },
                { $set: { userId: assignedTo } }
            );
            await sendInApp(tenantId, assignedTo, {
                title: 'New Lead Assigned',
                message: `A new lead has been assigned to you`,
                type: 'action',
                actionUrl: `/leads/${leadId}`,
                actionType: 'lead',
                branchId: data.branchId,
            });
            await sendPushToUser({
                tenantId,
                userId: assignedTo,
                title: 'New Lead Assigned',
                body: 'A new lead has been assigned to you',
                data: { type: 'lead_assigned', leadId, actionUrl: `/leads/${leadId}` },
            });
        } catch (err) {
            console.error('❌ lead.assigned notification error:', err.message);
        }
    });

    // ─── Meeting booked → notify host ───
    await subscribeToEvents(EVENTS.MEETING_BOOKED, async (_channel, data) => {
        try {
            const { tenantId, meetingId, hostId } = data;
            if (!hostId) return;
            await sendInApp(tenantId, hostId, {
                title: 'New Meeting Booked',
                message: 'Someone has scheduled a meeting with you',
                type: 'info',
                actionUrl: `/meetings/${meetingId}`,
                actionType: 'meeting',
                data: { meetingId },
                branchId: data.branchId,
            });
            await sendPushToUser({
                tenantId,
                userId: hostId,
                title: 'New Meeting Booked',
                body: 'Someone has scheduled a meeting with you',
                data: { type: 'meeting_booked', meetingId, actionUrl: '/meetings' },
            });
        } catch (err) {
            console.error('❌ meeting.booked notification error:', err.message);
        }
    });

    // ─── Payment success → notify admin ───
    await subscribeToEvents(EVENTS.PAYMENT_SUCCESS, async (_channel, data) => {
        try {
            const { tenantId, amount, type } = data;
            await sendInApp(tenantId, null, {
                title: 'Payment Successful',
                message: `Payment of ₹${amount} for ${type} received`,
                type: 'success',
                actionType: 'payment',
                branchId: data.branchId,
            });
        } catch (err) {
            console.error('❌ payment.success notification error:', err.message);
        }
    });

    // ─── Call missed → notify caller ───
    await subscribeToEvents(EVENTS.CALL_MISSED, async (_channel, data) => {
        try {
            const { tenantId, callId, leadId, userId } = data;
            await sendInApp(tenantId, userId || null, {
                title: 'Missed Call',
                message: `You missed a call${leadId ? ` from lead` : ''}`,
                type: 'warning',
                actionUrl: leadId ? `/leads/${leadId}` : '/calls',
                actionType: leadId ? 'lead' : 'call',
                branchId: data.branchId,
            });
            if (userId) {
                await sendPushToUser({
                    tenantId,
                    userId,
                    title: 'Missed Call',
                    body: leadId ? 'You missed a call from a lead' : 'You missed a call',
                    data: { type: 'call_missed', callId, leadId: leadId || '', actionUrl: leadId ? `/leads/${leadId}` : '/calls' },
                });
                const realtimeService = require('../services/realtime.service');
                realtimeService.emitToUser(userId, 'call_completed', { callId, leadId });
            }
        } catch (err) {
            console.error('❌ call.missed notification error:', err.message);
        }
    });

    // ─── Call completed → notify UI via socket ───
    await subscribeToEvents(EVENTS.CALL_COMPLETED, async (_channel, data) => {
        try {
            const { callId, leadId, userId } = data;
            if (userId) {
                const realtimeService = require('../services/realtime.service');
                realtimeService.emitToUser(userId, 'call_completed', { callId, leadId });
            }
        } catch (err) {
            console.error('❌ call.completed notification error:', err.message);
        }
    });

    // ─── Call recording ready → notify UI via socket ───
    await subscribeToEvents('CALL_RECORDING_READY', async (_channel, data) => {
        try {
            const { callId, userId, recordingUrl } = data;
            if (userId) {
                const realtimeService = require('../services/realtime.service');
                realtimeService.emitToUser(userId, 'call_recording_ready', { callId, recordingUrl });
            }
        } catch (err) {
            console.error('❌ call.recording_ready notification error:', err.message);
        }
    });

    console.log('✅ notification-service: event listeners registered');
};

module.exports = { registerEventListeners };
