const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { env } = require('@sparkcrm/shared-config');
const executors = require('../handlers/actionExecutors');
const { AutomationRule, AutomationLog } = require('../models/AutomationRule');
const { findNextNode, evaluateNodeBranch } = require('../engine/workflowEngine');

// Dedicated worker connection — BullMQ requires Queue and Worker to use
// SEPARATE IORedis instances. Sharing a connection causes stalls when one
// side enters blocking mode.
const workerConnection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 10000),
    reconnectOnError: (err) => {
        const transientErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return transientErrors.some((e) => err.message.includes(e)) ? 2 : false;
    },
});

const automationWorker = new Worker('AutomationActionQueue', async (job) => {
    const { logId, tenantId, node, triggerData } = job.data;

    console.log(`👷 Processing node: ${node.type} (${node.id}) for log ${logId}`);

    let result = null;
    let edgeHandle = null;

    try {
        if (node.type === 'action') {
            switch (node.actionType) {
                case 'assign_lead':
                    result = await executors.assignLead(tenantId, node, triggerData);
                    break;
                case 'change_stage':
                    result = await executors.changeStage(tenantId, node, triggerData);
                    break;
                case 'add_tag':
                    result = await executors.addTag(tenantId, node, triggerData);
                    break;
                case 'send_email':
                    result = await executors.sendEmail(tenantId, node, triggerData);
                    break;
                case 'send_whatsapp':
                    result = await executors.sendWhatsapp(tenantId, node, triggerData);
                    break;
                case 'webhook':
                    result = await executors.webhook(tenantId, node, triggerData);
                    break;
                case 'change_status':
                    result = await executors.changeStatus(tenantId, node, triggerData);
                    break;
                case 'create_follow_up':
                    result = await executors.createFollowUp(tenantId, node, triggerData);
                    break;
                case 'create_task':
                    result = await executors.createTask(tenantId, node, triggerData);
                    break;
                default:
                    throw new Error(`Unsupported action type: ${node.actionType}`);
            }
        } else if (node.type === 'condition') {
            edgeHandle = evaluateNodeBranch(node, triggerData);
            result = { conditionMet: edgeHandle === 'true' };
        } else if (node.type === 'wait') {
            result = { waited: true };
        }

        return { success: true, edgeHandle, result };
    } catch (error) {
        console.error(`❌ Node ${node.type} failed:`, error.message);
        throw error; // Let BullMQ handle retries
    }
}, { connection: workerConnection });

// Update AutomationLog on completion
automationWorker.on('completed', async (job, returnvalue) => {
    try {
        const { logId, tenantId, node, triggerData, ruleGraph } = job.data;
        const { edgeHandle, result } = returnvalue;

        await AutomationLog.updateOne(
            { _id: logId },
            {
                $push: {
                    nodeExecutions: {
                        nodeId: node.id,
                        type: node.type,
                        status: 'success',
                        result,
                        executedAt: new Date()
                    }
                }
            }
        );

        // Use embedded ruleGraph to find next node — avoids 2 DB queries per node.
        // Falls back to DB fetch only if ruleGraph was not provided (legacy jobs).
        let nodes, edges, ruleId;
        if (ruleGraph && ruleGraph.nodes && ruleGraph.edges) {
            nodes = ruleGraph.nodes;
            edges = ruleGraph.edges;
            ruleId = ruleGraph.ruleId;
        } else {
            // Fallback: fetch from DB (old jobs without ruleGraph in payload)
            const log = await AutomationLog.findById(logId).lean();
            if (!log) return;
            const rule = await AutomationRule.findById(log.ruleId).lean();
            if (!rule) return;
            nodes = rule.nodes;
            edges = rule.edges;
            ruleId = rule._id;
        }

        // Build a minimal rule-like object for findNextNode
        const ruleProxy = { nodes, edges };
        const nextNode = findNextNode(ruleProxy, node.id, edgeHandle);

        if (nextNode) {
            await AutomationLog.updateOne({ _id: logId }, { $set: { currentNodeId: nextNode.id } });

            const { enqueueAction } = require('./automationQueue');
            await enqueueAction(logId, tenantId, nextNode, triggerData, ruleGraph);
        } else {
            const finalStatus = edgeHandle === 'false' ? 'exited' : 'completed';
            await AutomationLog.updateOne(
                { _id: logId },
                { $set: { status: finalStatus, currentNodeId: null } }
            );
            console.log(`✅ Workflow ${logId} ${finalStatus}.`);
        }

    } catch (err) {
        console.error('Failed to update AutomationLog on complete:', err.message);
    }
});

// Update AutomationLog on failure (only after all retries exhausted)
automationWorker.on('failed', async (job, err) => {
    if (job.attemptsMade >= job.opts.attempts) {
        try {
            const { logId, node } = job.data;
            await AutomationLog.updateOne(
                { _id: logId },
                {
                    $push: {
                        nodeExecutions: {
                            nodeId: node.id,
                            type: node.type,
                            status: 'failed',
                            result: { error: err.message },
                            executedAt: new Date()
                        }
                    },
                    $set: { status: 'failed' }
                }
            );
            console.error(`❌ Workflow failed on node ${node.id}: ${err.message}`);
        } catch (dbErr) {
            console.error('Failed to update AutomationLog on failure:', dbErr.message);
        }
    }
});

module.exports = { automationWorker };
