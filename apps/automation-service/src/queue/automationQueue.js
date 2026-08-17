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
 * Add an action to the execution queue
 * @param {string} logId - The ID of the AutomationLog tracking this execution
 * @param {string} tenantId
 * @param {object} action - The action configuration { type, config, delay }
 * @param {object} triggerData - The payload that triggered the event (e.g. lead data)
 */
const enqueueAction = async (logId, tenantId, action, triggerData) => {
    const delayMs = (action.delay || 0) * 60 * 1000;
    
    await automationQueue.add(action.type, {
        logId,
        tenantId,
        action,
        triggerData,
    }, {
        delay: delayMs,
    });
};

module.exports = { automationQueue, enqueueAction, connection };
