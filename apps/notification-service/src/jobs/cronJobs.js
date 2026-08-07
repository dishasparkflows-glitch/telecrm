const cron = require('node-cron');
const Notification = require('../models/Notification');
const Reminder = require('../models/Reminder');
const { sendPushToUser } = require('../channels/push.channel');

const buildReminderClaimFilter = (now = new Date()) => ({
    dueAt: { $lte: now },
    $or: [
        { status: 'pending' },
        { status: 'processing', processingAt: { $lte: new Date(now.getTime() - 5 * 60_000) } },
    ],
});

const getReminderRetry = (attempts, now = new Date()) => ({
    status: attempts >= 5 ? 'failed' : 'pending',
    dueAt: attempts >= 5 ? null : new Date(now.getTime() + Math.min(15 * 60_000, 30_000 * (2 ** attempts))),
});

const processDueReminders = async (limit = 100) => {
    let processed = 0;
    while (processed < limit) {
        const reminder = await Reminder.findOneAndUpdate(
            buildReminderClaimFilter(),
            { $set: { status: 'processing', processingAt: new Date() } },
            { new: true, sort: { dueAt: 1 } }
        );
        if (!reminder) break;

        try {
            await Notification.create({
                tenantId: reminder.tenantId,
                branchId: reminder.branchId,
                userId: reminder.userId,
                title: reminder.title,
                message: reminder.message,
                type: 'action',
                channel: 'in_app',
                actionUrl: reminder.actionUrl,
                data: { reminderId: reminder._id, leadId: reminder.leadId, type: reminder.type },
            });
            await sendPushToUser({
                tenantId: reminder.tenantId,
                userId: reminder.userId,
                title: reminder.title,
                body: reminder.message,
                data: { reminderId: reminder._id, leadId: reminder.leadId, type: reminder.type, actionUrl: reminder.actionUrl },
            });
            reminder.status = 'sent';
            reminder.sentAt = new Date();
            reminder.processingAt = null;
            reminder.lastError = '';
        } catch (error) {
            reminder.attempts += 1;
            reminder.processingAt = null;
            reminder.lastError = String(error.message || error).slice(0, 1000);
            const retry = getReminderRetry(reminder.attempts);
            reminder.status = retry.status;
            if (retry.dueAt) reminder.dueAt = retry.dueAt;
        }
        await reminder.save();
        processed += 1;
    }
    return processed;
};

const registerCronJobs = () => {
    console.log('⏰ notification-service: Registering cron jobs...');

    // ─── Every minute: deliver due lead follow-up reminders ───
    cron.schedule('* * * * *', async () => {
        try { await processDueReminders(); }
        catch (err) { console.error('❌ Follow-up reminder cron error:', err.message); }
    });

    // ─── Weekly Sunday midnight: Clean up old notifications (90+ days) ───
    cron.schedule('0 0 * * 0', async () => {
        try {
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const deleted = await Notification.deleteMany({
                createdAt: { $lt: ninetyDaysAgo },
                isRead: true,
            });
            if (deleted.deletedCount > 0) {
                console.log(`⏰ Cleaned up ${deleted.deletedCount} old notifications`);
            }
        } catch (err) {
            console.error('❌ Notification cleanup cron error:', err.message);
        }
    });

    console.log('✅ notification-service: 2 cron jobs registered');
};

module.exports = { registerCronJobs, processDueReminders, buildReminderClaimFilter, getReminderRetry };
