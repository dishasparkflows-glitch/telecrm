const cron = require('node-cron');
const CallLog = require('../models/CallLog');
const callingApiService = require('../services/callingApi.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

let isSyncing = false;

const syncMissingExotelRecordings = async () => {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
        console.log('🔄 [CRON] Starting sweep for missing Exotel recordings...');
        
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000);
        
        // Find calls where webhook probably failed to complete them
        // OR where they completed but recording is still stuck processing
        const stuckCalls = await CallLog.find({
            'provider.name': 'exotel',
            $or: [
                {
                    'call.status': { $in: ['initiated', 'ringing', 'in_progress'] },
                    'audit.createdAt': { $lt: fiveMinsAgo }
                },
                {
                    'recording.status': 'processing',
                    'audit.updatedAt': { $lt: threeMinsAgo }
                }
            ]
        }).limit(20);

        if (stuckCalls.length === 0) {
            console.log('✅ [CRON] No missing recordings found.');
            isSyncing = false;
            return;
        }

        console.log(`⚠️ [CRON] Found ${stuckCalls.length} stuck CallLogs. Syncing...`);

        for (const callLog of stuckCalls) {
            try {
                if (!callLog.provider?.externalCallId) continue;
                
                const callSid = callLog.provider.externalCallId;
                const details = await callingApiService.getCallStatus(callLog.tenantId, callSid);
                
                let updated = false;

                // Sync status if it was stuck
                if (['completed', 'failed', 'missed', 'busy', 'no-answer'].includes(details.status) && !['completed', 'failed', 'missed'].includes(callLog.call.status)) {
                    callLog.call.status = details.status === 'completed' ? 'completed' : (details.status === 'busy' || details.status === 'no-answer' ? 'missed' : 'failed');
                    updated = true;
                }

                // Sync duration
                if (details.duration !== undefined && details.duration > 0 && (!callLog.call.duration || callLog.call.duration < details.duration)) {
                    callLog.call.duration = details.duration;
                    callLog.recording.duration = details.duration;
                    updated = true;
                }

                // Sync recording URL
                if (details.recordingUrl && !callLog.recording.url) {
                    console.log(`[CRON] Recording recovered for Call SID: ${callSid}`);
                    callLog.recording.url = details.recordingUrl;
                    callLog.recording.status = 'ready';
                    callLog.recording.fetchedAt = new Date();
                    updated = true;
                } else if (details.status === 'completed' && !details.recordingUrl && callLog.recording.status === 'processing') {
                    // It's been > 3 mins processing and Exotel still doesn't have it.
                    // Keep it processing for now, or maybe mark it unavailable if it's too old
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    if (callLog.audit.createdAt < oneHourAgo) {
                        console.log(`[CRON] Recording permanently unavailable for Call SID: ${callSid}`);
                        callLog.recording.status = 'unavailable';
                        updated = true;
                    }
                }

                if (updated) {
                    await callLog.save();
                    
                    if (callLog.call.status === 'completed' && !callLog.events.processed?.includes('CALL_COMPLETED')) {
                        await publishEvent(EVENTS.CALL_COMPLETED, {
                            tenantId: callLog.tenantId,
                            callId: callLog._id,
                            leadId: callLog.leadId,
                            userId: callLog.userId,
                            duration: callLog.call.duration,
                        });
                        callLog.events.processed.push('CALL_COMPLETED');
                        await callLog.save();
                    }

                    if (callLog.recording.status === 'ready' && !callLog.events.processed?.includes('CALL_RECORDING_READY')) {
                        await publishEvent('CALL_RECORDING_READY', {
                            tenantId: callLog.tenantId,
                            callId: callLog._id,
                            callSid: callSid,
                            recordingUrl: details.recordingUrl,
                            userId: callLog.userId
                        });
                        callLog.events.processed.push('CALL_RECORDING_READY');
                        await callLog.save();
                    }
                }
            } catch (err) {
                console.error(`❌ [CRON] Error syncing call ${callLog._id}:`, err.message);
            }
        }
        
    } catch (error) {
        console.error('❌ [CRON] Sweep failed:', error.message);
    } finally {
        isSyncing = false;
    }
};

const registerCronJobs = () => {
    // Run every 2 minutes
    cron.schedule('*/2 * * * *', () => {
        syncMissingExotelRecordings().catch(console.error);
    });
    console.log('✅ call-service: Cron jobs registered');
};

module.exports = {
    registerCronJobs,
    syncMissingExotelRecordings
};
