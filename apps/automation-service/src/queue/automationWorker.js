const { Worker } = require('bullmq');
const { connection } = require('./automationQueue');
const executors = require('../handlers/actionExecutors');
const { AutomationLog } = require('../models/AutomationRule');

const automationWorker = new Worker('AutomationActionQueue', async (job) => {
    const { logId, tenantId, action, triggerData } = job.data;
    
    console.log(`👷 Processing automation action: ${action.type} for log ${logId}`);
    
    try {
        switch (action.type) {
            case 'assign_lead':
                await executors.assignLead(tenantId, action, triggerData);
                break;
            case 'change_stage':
                await executors.changeStage(tenantId, action, triggerData);
                break;
            case 'add_tag':
                await executors.addTag(tenantId, action, triggerData);
                break;
            case 'send_email':
                await executors.sendEmail(tenantId, action, triggerData);
                break;
            case 'send_whatsapp':
                await executors.sendWhatsapp(tenantId, action, triggerData);
                break;
            case 'webhook':
                await executors.webhook(tenantId, action, triggerData);
                break;
            default:
                throw new Error(`Unsupported action type: ${action.type}`);
        }
        
        return { success: true };
    } catch (error) {
        console.error(`❌ Action ${action.type} failed:`, error.message);
        throw error; // Let BullMQ handle retries
    }
}, { connection });

// Update AutomationLog on completion
automationWorker.on('completed', async (job, returnvalue) => {
    try {
        const { logId, action } = job.data;
        
        await AutomationLog.updateOne(
            { _id: logId, 'actionsExecuted._id': action._id },
            { 
                $set: { 
                    'actionsExecuted.$.status': 'success',
                    'actionsExecuted.$.result': returnvalue
                } 
            }
        );
        
        // Check if all actions are complete to update overall status
        const log = await AutomationLog.findById(logId);
        if (log) {
            const allComplete = log.actionsExecuted.every(a => a.status === 'success' || a.status === 'failed');
            if (allComplete) {
                log.status = log.actionsExecuted.every(a => a.status === 'success') ? 'success' : 
                             log.actionsExecuted.some(a => a.status === 'success') ? 'partial' : 'failed';
                await log.save();
            }
        }
    } catch (err) {
        console.error('Failed to update AutomationLog on complete:', err.message);
    }
});

// Update AutomationLog on failure
automationWorker.on('failed', async (job, err) => {
    // Only mark failed in DB if we are completely out of retries (or if we want to log every attempt)
    // BullMQ job.attemptsMade tells us the current attempt
    if (job.attemptsMade >= job.opts.attempts) {
        try {
            const { logId, action } = job.data;
            await AutomationLog.updateOne(
                { _id: logId, 'actionsExecuted._id': action._id },
                { 
                    $set: { 
                        'actionsExecuted.$.status': 'failed',
                        'actionsExecuted.$.result': { error: err.message }
                    } 
                }
            );
            
            const log = await AutomationLog.findById(logId);
            if (log) {
                const allComplete = log.actionsExecuted.every(a => a.status === 'success' || a.status === 'failed');
                if (allComplete) {
                    log.status = log.actionsExecuted.every(a => a.status === 'success') ? 'success' : 
                                 log.actionsExecuted.some(a => a.status === 'success') ? 'partial' : 'failed';
                    await log.save();
                }
            }
        } catch (dbErr) {
            console.error('Failed to update AutomationLog on failure:', dbErr.message);
        }
    }
});

module.exports = { automationWorker };
