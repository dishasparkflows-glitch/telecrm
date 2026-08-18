const { Worker } = require('bullmq');
const { connection } = require('./automationQueue');
const executors = require('../handlers/actionExecutors');
const { AutomationRule, AutomationLog } = require('../models/AutomationRule');
const { findNextNode, evaluateNodeBranch } = require('../engine/workflowEngine');

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
}, { connection });

// Update AutomationLog on completion
automationWorker.on('completed', async (job, returnvalue) => {
    try {
        const { logId, tenantId, node, triggerData } = job.data;
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
        
        // Find next node
        const log = await AutomationLog.findById(logId);
        if (!log) return;
        
        const rule = await AutomationRule.findById(log.ruleId);
        if (!rule) return;

        const nextNode = findNextNode(rule, node.id, edgeHandle);

        if (nextNode) {
            log.currentNodeId = nextNode.id;
            await log.save();

            const { enqueueAction } = require('./automationQueue');
            await enqueueAction(logId, tenantId, nextNode, triggerData);
        } else {
            // Workflow complete or exited
            log.status = edgeHandle === 'false' ? 'exited' : 'completed';
            log.currentNodeId = null;
            await log.save();
            console.log(`✅ Workflow ${log.ruleName} ${log.status}.`);
        }

    } catch (err) {
        console.error('Failed to update AutomationLog on complete:', err.message);
    }
});

// Update AutomationLog on failure
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
                    $set: {
                        status: 'failed'
                    }
                }
            );
            console.error(`❌ Workflow failed on node ${node.id}`);
        } catch (dbErr) {
            console.error('Failed to update AutomationLog on failure:', dbErr.message);
        }
    }
});

module.exports = { automationWorker };
