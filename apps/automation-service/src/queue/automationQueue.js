const { Queue } = require('bullmq');
const { env } = require('@sparkcrm/shared-config');
const IORedis = require('ioredis');

// Dedicated BullMQ queue connection (separate from worker connection — BullMQ requirement)
const queueConnection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 10000),
    reconnectOnError: (err) => {
        const transientErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return transientErrors.some((e) => err.message.includes(e)) ? 2 : false;
    },
});
queueConnection.on('error', () => {});

const automationQueue = new Queue('AutomationActionQueue', {
    connection: queueConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            // 5s base → 5s, 10s, 20s retries.
            // Previously 60s base which was far too slow for CRM actions.
            delay: 5000,
        },
        // Keep last 500 completed jobs for 24h for debugging and audit.
        // Previously 'true' which removed ALL history immediately.
        removeOnComplete: { count: 500, age: 86400 },
        removeOnFail: { count: 1000 },
    },
});

/**
 * Add a node to the execution queue.
 * The full rule graph (nodes + edges) is embedded in the job payload so the
 * worker never needs to re-query MongoDB just to find the next node.
 *
 * @param {string} logId       - The AutomationLog._id tracking this execution
 * @param {string} tenantId
 * @param {object} node        - The node configuration to execute
 * @param {object} triggerData - The payload that triggered the event (e.g. lead data)
 * @param {object} ruleGraph   - { nodes, edges } from the AutomationRule (avoids N+1 DB fetches)
 */
const enqueueAction = async (logId, tenantId, node, triggerData, ruleGraph = null) => {
    let delayMs = 0;

    if (node.type === 'wait' && node.delay) {
        const value = Number(node.delay.value) || 0;
        if (node.delay.unit === 'minutes') delayMs = value * 60 * 1000;
        else if (node.delay.unit === 'hours') delayMs = value * 60 * 60 * 1000;
        else if (node.delay.unit === 'days') delayMs = value * 24 * 60 * 60 * 1000;
    }

    await automationQueue.add(node.type, {
        logId,
        tenantId,
        node,
        triggerData,
        // Embed the rule graph so the worker can find the next node without a DB query
        ruleGraph,
    }, {
        delay: delayMs,
    });
};

automationQueue.on('error', () => {});

module.exports = { automationQueue, enqueueAction, queueConnection };
