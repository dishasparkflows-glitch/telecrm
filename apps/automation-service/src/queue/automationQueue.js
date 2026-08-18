const { Queue } = require('bullmq');
const { env } = require('@sparkcrm/shared-config');
const IORedis = require('ioredis');

const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

const automationQueue = new Queue('AutomationActionQueue', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000 * 60,
        },
        removeOnComplete: true,
        removeOnFail: 1000,
    },
});

/**
 * Add a node to the execution queue
 * @param {string} logId - The ID of the AutomationLog tracking this execution
 * @param {string} tenantId
 * @param {object} node - The node configuration to execute
 * @param {object} triggerData - The payload that triggered the event (e.g. lead data)
 */
const enqueueAction = async (logId, tenantId, node, triggerData) => {
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
    }, {
        delay: delayMs,
    });
};

module.exports = { automationQueue, enqueueAction, connection };
