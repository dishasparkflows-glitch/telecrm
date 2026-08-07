const { LeadSourceConnection } = require('../models/LeadSourceModels');
const { testMetaConnection } = require('../services/metaLeadAds.service');

const HEALTH_CHECK_INTERVAL_MS = 6 * 60 * 60_000;
const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60_000;

const checkMetaConnection = async (connection) => {
    const now = new Date();
    if (connection.tokenExpiresAt && connection.tokenExpiresAt <= now) {
        connection.health = { status: 'failed', message: 'Meta access token has expired. Reconnect the Meta account.', checkedAt: now };
        await connection.save();
        return connection.health;
    }

    try {
        const identity = await testMetaConnection({ connection });
        const expiring = connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() - now.getTime() <= EXPIRING_WINDOW_MS;
        connection.health = {
            status: expiring ? 'expiring' : 'healthy',
            message: expiring
                ? `Connected as ${identity.name || identity.id}; token expires soon. Reconnect Meta.`
                : `Connected as ${identity.name || identity.id}`,
            checkedAt: now,
        };
    } catch (error) {
        connection.health = {
            status: 'failed',
            message: error.response?.data?.error?.message || error.message || 'Meta connection check failed',
            checkedAt: now,
        };
    }
    await connection.save();
    return connection.health;
};

const checkMetaConnections = async (limit = 50) => {
    const connections = await LeadSourceConnection.find({
        provider: 'meta_lead_ads',
        isActive: true,
        accessToken: { $ne: '' },
    }).sort({ 'health.checkedAt': 1 }).limit(Math.max(1, Math.min(Number(limit) || 50, 100)));

    for (const connection of connections) await checkMetaConnection(connection);
    return connections.length;
};

const registerMetaConnectionHealthWorker = () => {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            await checkMetaConnections();
        } catch (error) {
            console.error('Meta connection health worker failed:', error.message);
        } finally {
            running = false;
        }
    };
    const initialTimer = setTimeout(run, 30_000);
    initialTimer.unref?.();
    const timer = setInterval(run, HEALTH_CHECK_INTERVAL_MS);
    timer.unref?.();
    return timer;
};

module.exports = { checkMetaConnection, checkMetaConnections, registerMetaConnectionHealthWorker };
