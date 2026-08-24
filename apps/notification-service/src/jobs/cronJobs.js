const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { env } = require('@sparkcrm/shared-config');
const Notification = require('../models/Notification');
const Reminder = require('../models/Reminder');
const { sendPushToUser } = require('../channels/push.channel');

// ─── Redis connection for the reminder queue ──────────────────────────────────
const reminderConnection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 10000),
    reconnectOnError: (err) => {
        const transientErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return transientErrors.some((e) => err.message.includes(e)) ? 2 : false;
    },
});
reminderConnection.on('error', () => {});

const workerConnection = reminderConnection.duplicate();
workerConnection.on('error', () => {});

const REMINDER_QUEUE_NAME = 'ReminderQueue';

// ─── Atomic claim filter ──────────────────────────────────────────────────────
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

// ─── Core processing logic (reused by both BullMQ worker and legacy node-cron) ─
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

// ─── BullMQ Queue + Repeatable Job ───────────────────────────────────────────
// Replaces node-cron to ensure only ONE instance processes reminders even when
// multiple notification-service replicas are running.
let reminderQueue = null;
let reminderWorker = null;

const registerCronJobs = async () => {
    console.log('⏰ notification-service: Registering jobs...');

    try {
        reminderQueue = new Queue(REMINDER_QUEUE_NAME, { connection: reminderConnection });
        reminderQueue.on('error', () => {});

        // Remove any existing repeatable jobs to avoid duplicates on restart
        const repeatableJobs = await reminderQueue.getRepeatableJobs();
        for (const job of repeatableJobs) {
            await reminderQueue.removeRepeatableByKey(job.key);
        }

        // Schedule: process due reminders every 60 seconds
        await reminderQueue.add(
            'process-reminders',
            {},
            {
                repeat: { every: 60 * 1000 }, // every 1 minute
                removeOnComplete: { count: 10 },
                removeOnFail: { count: 50 },
            }
        );

        reminderWorker = new Worker(
            REMINDER_QUEUE_NAME,
            async () => {
                const count = await processDueReminders();
                if (count > 0) {
                    console.log(`⏰ Processed ${count} due reminder(s)`);
                }
            },
            { connection: workerConnection }
        );
        reminderWorker.on('error', () => {});

        reminderWorker.on('failed', (job, err) => {
            console.error('❌ Reminder job failed:', err.message);
        });

        console.log('✅ notification-service: BullMQ repeatable reminder job registered (every 60s)');

        // ─── Weekly cleanup: delete read notifications older than 90 days ──────
        const cleanupQueue = new Queue('NotificationCleanupQueue', {
            connection: reminderConnection.duplicate(),
        });
        cleanupQueue.on('error', () => {});

        const cleanupWorkerConn = reminderConnection.duplicate();
        cleanupWorkerConn.on('error', () => {});
        const cleanupWorker = new Worker(
            'NotificationCleanupQueue',
            async () => {
                const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                const deleted = await Notification.deleteMany({
                    createdAt: { $lt: ninetyDaysAgo },
                    isRead: true,
                });
                if (deleted.deletedCount > 0) {
                    console.log(`⏰ Cleaned up ${deleted.deletedCount} old notifications`);
                }
            },
            { connection: cleanupWorkerConn }
        );
        cleanupWorker.on('error', () => {});

        cleanupWorker.on('failed', (job, err) => {
            console.error('❌ Cleanup job failed:', err.message);
        });

        const cleanupRepeatableJobs = await cleanupQueue.getRepeatableJobs();
        for (const job of cleanupRepeatableJobs) {
            await cleanupQueue.removeRepeatableByKey(job.key);
        }

        await cleanupQueue.add(
            'cleanup-notifications',
            {},
            {
                repeat: { cron: '0 0 * * 0' }, // every Sunday midnight
                removeOnComplete: { count: 5 },
                removeOnFail: { count: 10 },
            }
        );

        console.log('✅ notification-service: 2 BullMQ jobs registered');
    } catch (err) {
        console.warn('⚠️  BullMQ jobs unavailable (Redis down?), falling back to node-cron:', err.message);

        // Graceful fallback to node-cron if BullMQ/Redis is unavailable
        const cron = require('node-cron');
        cron.schedule('* * * * *', async () => {
            try { await processDueReminders(); }
            catch (e) { console.error('❌ Follow-up reminder cron error:', e.message); }
        });
        cron.schedule('0 0 * * 0', async () => {
            try {
                const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                await Notification.deleteMany({ createdAt: { $lt: ninetyDaysAgo }, isRead: true });
            } catch (e) { console.error('❌ Notification cleanup error:', e.message); }
        });
        console.log('✅ notification-service: node-cron fallback registered');
    }
};

module.exports = { registerCronJobs, processDueReminders, buildReminderClaimFilter, getReminderRetry };
