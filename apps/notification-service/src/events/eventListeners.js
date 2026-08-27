const { EVENTS, subscribeToEvents } = require('@sparkcrm/shared-events');
const Reminder = require('../models/Reminder');
const ReminderSettings = require('../models/ReminderSettings');
const { sendInApp } = require('../channels/inApp.channel');
const { sendTemplateEmail } = require('../channels/email.channel');
const { sendPushToUser } = require('../channels/push.channel');
const { sendSms } = require('../channels/sms.channel');

const getReminderOffset = async (tenantId, userId, activityType, customReminder) => {
    let offsetMinutes = activityType === 'meeting' ? 60 : activityType === 'followUp' ? 15 : 30;
    
    if (customReminder) {
        if (!customReminder.enabled) return null;
        return customReminder.offsetMinutes;
    }

    const settings = await ReminderSettings.findOne({ tenantId, userId });
    if (settings?.defaultReminders?.[activityType]) {
        if (!settings.defaultReminders[activityType].enabled) return null;
        return settings.defaultReminders[activityType].offsetMinutes;
    }
    return offsetMinutes;
};

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

    // ─── SMS notification ───
    await subscribeToEvents(EVENTS.SEND_SMS, async (_channel, data) => {
        try {
            const { to, message } = data;
            if (to && message) {
                await sendSms(to, message);
            }
        } catch (err) {
            console.error('❌ notification.sms handler error:', err.message);
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
            const offsetMinutes = await getReminderOffset(tenantId, assignedTo, 'followUp', data.reminder);
            if (offsetMinutes === null) {
                // Delete pending reminders if any
                await Reminder.deleteMany({ tenantId, leadId, type: 'lead_follow_up' });
                return;
            }

            const dueAt = new Date(new Date(followUpAt).getTime() - offsetMinutes * 60000);

            await Reminder.findOneAndUpdate(
                { tenantId, leadId, type: 'lead_follow_up' },
                {
                    $set: {
                        branchId: branchId || null,
                        userId: assignedTo,
                        title: 'Lead follow-up due',
                        message: `Follow up with ${leadName || 'this lead'}`,
                        actionUrl: `/leads/${leadId}`,
                        dueAt,
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

    // ─── Lead created → broadcast to UI ───
    await subscribeToEvents(EVENTS.LEAD_CREATED, async (_channel, data) => {
        try {
            const { tenantId, leadId, assignedTo } = data;
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'lead_created', { leadId, assignedTo });
        } catch (err) {
            console.error('❌ lead.created notification error:', err.message);
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
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'lead_assigned', { leadId, assignedTo });
        } catch (err) {
            console.error('❌ lead.assigned notification error:', err.message);
        }
    });

    // ─── Meeting booked → notify host ───
    await subscribeToEvents(EVENTS.MEETING_BOOKED, async (_channel, data) => {
        try {
            const { tenantId, meetingId, hostId, inviteeEmails, meetingTitle, scheduledAt, meetingUrl, duration } = data;
            
            // Send email to invitees
            if (inviteeEmails && inviteeEmails.length > 0) {
                for (const email of inviteeEmails) {
                    await sendTemplateEmail(email, 'meeting_invite', {
                        meetingTitle,
                        scheduledAt,
                        meetingUrl,
                        duration
                    });
                }
            }

            const usersToNotify = [hostId];
            if (data.attendeeIds && Array.isArray(data.attendeeIds)) {
                data.attendeeIds.forEach(id => {
                    if (id && id !== hostId) usersToNotify.push(id);
                });
            }

            for (const userId of usersToNotify) {
                if (!userId) continue;
                await sendInApp(tenantId, userId, {
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
                    userId: userId,
                    title: 'New Meeting Booked',
                    body: 'Someone has scheduled a meeting with you',
                    data: { type: 'meeting_booked', meetingId, actionUrl: '/meetings' },
                });
            }

            // Create reminder
            if (scheduledAt) {
                for (const userId of usersToNotify) {
                    if (!userId) continue;
                    const offsetMinutes = await getReminderOffset(tenantId, userId, 'meeting', data.reminder);
                    if (offsetMinutes !== null) {
                        const dueAt = new Date(new Date(scheduledAt).getTime() - offsetMinutes * 60000);
                        await Reminder.findOneAndUpdate(
                            { tenantId, meetingId, userId, type: 'meeting_reminder' },
                            {
                                $set: {
                                    branchId: data.branchId || null,
                                    title: 'Upcoming Meeting',
                                    message: `Meeting "${meetingTitle || 'Scheduled Meeting'}" starts soon`,
                                    actionUrl: `/meetings/${meetingId}`,
                                    dueAt,
                                    status: 'pending',
                                    processingAt: null,
                                    sentAt: null,
                                    attempts: 0,
                                    lastError: '',
                                }
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                    }
                }
            }

            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'meeting_booked', { meetingId, scheduledAt });
        } catch (err) {
            console.error('❌ meeting.booked notification error:', err.message);
        }
    });

    // ─── Task Created / Assigned → Notify assigned user and Schedule Reminder ───
    const handleTaskEvent = async (eventName, data) => {
        try {
            const { tenantId, taskId, assignedTo, title, dueDate, reminder } = data;
            
            // Send In-App & Push Notification if newly assigned
            if (eventName === EVENTS.TASK_ASSIGNED && assignedTo) {
                await sendInApp(tenantId, assignedTo, {
                    title: 'New Task Assigned',
                    message: `You have been assigned a new task: ${title || 'Task'}`,
                    type: 'info',
                    actionUrl: '/tasks',
                    actionType: 'task',
                });
                await sendPushToUser({
                    tenantId,
                    userId: assignedTo,
                    title: 'New Task Assigned',
                    body: `You have been assigned a new task: ${title || 'Task'}`,
                    data: { type: 'task_assigned', actionUrl: '/tasks' },
                });
            }

            // Create reminder
            if (dueDate && assignedTo) {
                const offsetMinutes = await getReminderOffset(tenantId, assignedTo, 'task', reminder);
                if (offsetMinutes !== null) {
                    const dueAt = new Date(new Date(dueDate).getTime() - offsetMinutes * 60000);
                    
                    await Reminder.findOneAndUpdate(
                        { tenantId, taskId, type: 'task_due' },
                        {
                            $set: {
                                userId: assignedTo,
                                title: 'Task Due Soon',
                                message: `Task "${title || 'Untitled'}" is due soon`,
                                actionUrl: '/tasks',
                                dueAt,
                                status: 'pending',
                                processingAt: null,
                                sentAt: null,
                                attempts: 0,
                                lastError: '',
                            }
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );
                } else {
                    // Delete pending reminders if offset is null (disabled)
                    await Reminder.deleteMany({ tenantId, taskId, type: 'task_due' });
                }
            }
        } catch (err) {
            console.error(`❌ ${eventName} notification error:`, err.message);
        }
    };

    await subscribeToEvents(EVENTS.TASK_CREATED, (channel, data) => handleTaskEvent(EVENTS.TASK_CREATED, data));
    await subscribeToEvents(EVENTS.TASK_ASSIGNED, (channel, data) => handleTaskEvent(EVENTS.TASK_ASSIGNED, data));

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
                realtimeService.emitToUser(userId, 'call_completed', { tenantId, callId, leadId });
            }
        } catch (err) {
            console.error('❌ call.missed notification error:', err.message);
        }
    });

    // ─── Call completed → notify UI via socket ───
    await subscribeToEvents(EVENTS.CALL_COMPLETED, async (_channel, data) => {
        try {
            const { tenantId, callId, leadId, userId } = data;
            if (userId) {
                const realtimeService = require('../services/realtime.service');
                // tenantId MUST be in the data object — realtime.service drops events without it
                realtimeService.emitToUser(userId, 'call_completed', { tenantId, callId, leadId });
            }
        } catch (err) {
            console.error('❌ call.completed notification error:', err.message);
        }
    });

    // ─── Call recording ready → notify UI via socket ───
    await subscribeToEvents(EVENTS.CALL_RECORDING_READY, async (_channel, data) => {
        try {
            const { tenantId, callId, userId, recordingUrl } = data;
            if (userId) {
                const realtimeService = require('../services/realtime.service');
                realtimeService.emitToUser(userId, 'call_recording_ready', { tenantId, callId, recordingUrl });
            }
        } catch (err) {
            console.error('❌ call.recording_ready notification error:', err.message);
        }
    });

    // ─── Tasks Notifications ───
    await subscribeToEvents(EVENTS.TASK_ASSIGNED, async (_channel, data) => {
        try {
            const { tenantId, taskId, assignedTo, title, leadId } = data;
            if (!assignedTo) return;
            await Reminder.updateMany(
                { tenantId, taskId, type: 'task_due', status: 'pending' },
                { $set: { userId: assignedTo } }
            );
            await sendInApp(tenantId, assignedTo, {
                title: 'Task Assigned',
                message: `You have been assigned a task: ${title || 'No title'}`,
                type: 'info',
                actionUrl: leadId ? `/leads/${leadId}` : `/tasks`,
                actionType: 'task',
                data: { taskId }
            });
            await sendPushToUser({
                tenantId,
                userId: assignedTo,
                title: 'Task Assigned',
                body: `You have been assigned a task: ${title || 'No title'}`,
                data: { type: 'task_assigned', taskId, actionUrl: leadId ? `/leads/${leadId}` : `/tasks` },
            });
        } catch (err) {
            console.error('❌ task.assigned notification error:', err.message);
        }
    });

    await subscribeToEvents(EVENTS.TASK_CREATED, async (_channel, data) => {
        try {
            const { tenantId, taskId, assignedTo, title, leadId } = data;
            // Only notify if someone specific is assigned, but TASK_ASSIGNED usually handles it.
            // But we emit realtime so UI updates if there's a listener.
            if (assignedTo && data.dueDate) {
                await Reminder.findOneAndUpdate(
                    { tenantId, taskId, type: 'task_due' },
                    {
                        $set: {
                            userId: assignedTo,
                            title: 'Task Due',
                            message: `Your task "${title || 'No title'}" is due.`,
                            actionUrl: leadId ? `/leads/${leadId}` : `/tasks`,
                            dueAt: getReminderDate(data.dueDate, data.reminder) || new Date(data.dueDate),
                            status: 'pending',
                            processingAt: null,
                            sentAt: null,
                            attempts: 0,
                            lastError: '',
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            }
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'task_created', { taskId, title, leadId, assignedTo });
        } catch (err) {
            console.error('❌ task.created notification error:', err.message);
        }
    });

    await subscribeToEvents('task.updated', async (_channel, data) => {
        try {
            const { tenantId, taskId, assignedTo, title, leadId, status } = data;
            
            if (status === 'COMPLETED' || status === 'CANCELLED') {
                await Reminder.updateOne(
                    { tenantId, taskId, type: 'task_due', status: { $in: ['pending', 'processing'] } },
                    { $set: { status: 'cancelled', processingAt: null } }
                );
            } else if (data.dueDate && assignedTo) {
                await Reminder.findOneAndUpdate(
                    { tenantId, taskId, type: 'task_due' },
                    {
                        $set: {
                            userId: assignedTo,
                            title: 'Task Due',
                            message: `Your task "${title || 'No title'}" is due.`,
                            actionUrl: leadId ? `/leads/${leadId}` : `/tasks`,
                            dueAt: getReminderDate(data.dueDate, data.reminder) || new Date(data.dueDate),
                            status: 'pending',
                            processingAt: null,
                            sentAt: null,
                            attempts: 0,
                            lastError: '',
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } else if (data.dueDate === null) {
                await Reminder.updateOne(
                    { tenantId, taskId, type: 'task_due', status: { $in: ['pending', 'processing'] } },
                    { $set: { status: 'cancelled', processingAt: null } }
                );
            }

            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'task_updated', { taskId, title, status, leadId, assignedTo });
        } catch (err) {
            console.error('❌ task.updated notification error:', err.message);
        }
    });

    await subscribeToEvents(EVENTS.TASK_COMPLETED, async (_channel, data) => {
        try {
            const { tenantId, taskId, assignedTo, title, leadId } = data;
            if (assignedTo) {
                await sendInApp(tenantId, assignedTo, {
                    title: 'Task Completed',
                    message: `Task completed: ${title || 'No title'}`,
                    type: 'success',
                    actionUrl: leadId ? `/leads/${leadId}` : `/tasks`,
                    actionType: 'task',
                    data: { taskId }
                });
            }
            await Reminder.updateOne(
                { tenantId, taskId, type: 'task_due', status: { $in: ['pending', 'processing'] } },
                { $set: { status: 'cancelled', processingAt: null } }
            );
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'task_completed', { taskId, title, leadId, assignedTo });
        } catch (err) {
            console.error('❌ task.completed notification error:', err.message);
        }
    });

    // ─── Meeting Updates Notifications ───
    await subscribeToEvents(EVENTS.MEETING_CANCELLED, async (_channel, data) => {
        try {
            const { tenantId, meetingId, leadId } = data;
            // In a real app we'd fetch the meeting host or just emit real-time
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'meeting_cancelled', { meetingId, leadId });
        } catch (err) {
            console.error('❌ meeting.cancelled notification error:', err.message);
        }
    });

    await subscribeToEvents(EVENTS.MEETING_RESCHEDULED, async (_channel, data) => {
        try {
            const { tenantId, meetingId, leadId, scheduledAt } = data;
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'meeting_rescheduled', { meetingId, leadId, scheduledAt });
        } catch (err) {
            console.error('❌ meeting.rescheduled notification error:', err.message);
        }
    });

    await subscribeToEvents(EVENTS.MEETING_COMPLETED, async (_channel, data) => {
        try {
            const { tenantId, meetingId, leadId } = data;
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'meeting_completed', { meetingId, leadId });
        } catch (err) {
            console.error('❌ meeting.completed notification error:', err.message);
        }
    });

    // ─── Lead Stage Changed Notification ───
    await subscribeToEvents(EVENTS.LEAD_STAGE_CHANGED, async (_channel, data) => {
        try {
            const { tenantId, leadId, stage } = data;
            const realtimeService = require('../services/realtime.service');
            realtimeService.emitToTenant(tenantId, 'lead_stage_changed', { leadId, stage });
        } catch (err) {
            console.error('❌ lead.stage_changed notification error:', err.message);
        }
    });

    console.log('✅ notification-service: event listeners registered');
};

module.exports = { registerEventListeners };
