const cron = require('node-cron');
const { recalculateScores } = require('../services/scoring.service');
const Lead = require('../models/Lead');

const registerCronJobs = () => {
    console.log('⏰ lead-service: Registering cron jobs...');

    // ─── Every 6 hours: Recalculate AI lead scores ───
    cron.schedule('0 */6 * * *', async () => {
        try {
            // Get all active tenants with leads
            const tenantIds = await Lead.distinct('tenantId', { isArchived: false });

            let totalUpdated = 0;
            for (const tenantId of tenantIds) {
                const updated = await recalculateScores(tenantId);
                totalUpdated += updated;
            }

            if (totalUpdated > 0) {
                console.log(`⏰ Recalculated scores for ${totalUpdated} leads across ${tenantIds.length} tenants`);
            }
        } catch (err) {
            console.error('❌ Lead scoring cron error:', err.message);
        }
    });

    console.log('✅ lead-service: 1 cron job registered');
};

module.exports = { registerCronJobs };
