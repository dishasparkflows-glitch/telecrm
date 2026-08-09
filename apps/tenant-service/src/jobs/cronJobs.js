const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { processExpiredTrials } = require('../services/trial.service');

const registerCronJobs = () => {
    console.log('⏰ tenant-service: Registering cron jobs...');

    // ─── Hourly: Expire trials past 30 days ───
    cron.schedule('0 * * * *', async () => {
        try {
            const expired = await processExpiredTrials();
            if (expired.length > 0) {
                console.log(`⏰ Expired ${expired.length} trials`);
            }
        } catch (err) {
            console.error('❌ Trial expiry cron error:', err.message);
        }
    });

    // ─── Daily 9 AM: Trial reminder emails ───
    cron.schedule('0 9 * * *', async () => {
        try {
            const now = new Date();

            // Tenants with 3 days left
            const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const expiringTenants = await Tenant.find({
                status: 'trial',
                trialStatus: 'active',
                trialExpiresAt: { $lte: threeDays, $gte: now },
            });

            for (const tenant of expiringTenants) {
                const trialExpiresAt = tenant.trial?.expiresAt;
                const daysLeft = Math.ceil(
                    (new Date(trialExpiresAt) - now) / (1000 * 60 * 60 * 24)
                );

                await publishEvent(EVENTS.TENANT_TRIAL_EXPIRING, {
                    tenantId: tenant._id,
                    companyName: tenant.company?.name,
                    daysLeft,
                    email: tenant.company?.email,
                });
            }

            if (expiringTenants.length) {
                console.log(`⏰ Sent ${expiringTenants.length} trial reminder(s)`);
            }
        } catch (err) {
            console.error('❌ Trial reminder cron error:', err.message);
        }
    });

    // ─── Monthly: Archive inactive tenants (90+ days) ───
    cron.schedule('0 0 1 * *', async () => {
        try {
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const archived = await Tenant.updateMany(
                {
                    status: { $in: ['free', 'cancelled'] },
                    updatedAt: { $lt: ninetyDaysAgo },
                    isArchived: { $ne: true },
                },
                { $set: { isArchived: true } }
            );
            if (archived.modifiedCount > 0) {
                console.log(`⏰ Archived ${archived.modifiedCount} inactive tenants`);
            }
        } catch (err) {
            console.error('❌ Data archival cron error:', err.message);
        }
    });

    console.log('✅ tenant-service: 3 cron jobs registered');
};

module.exports = { registerCronJobs };
