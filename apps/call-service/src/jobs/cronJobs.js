const cron = require('node-cron');
const CallLog = require('../models/CallLog');
const callingApiService = require('../services/callingApi.service');
const axios = require('axios');
const { uploadBufferToR2 } = require('@sparkcrm/shared-utils');

let isSyncing = false;

const syncMissingRecordings = async () => {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
        console.log('🔄 [CRON] Starting sweep for missing recordings...');
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Find calls from today that are still active and missing a recording URL
        const stuckCalls = await CallLog.find({
            'provider.name': { $in: ['exotel', 'twilio'] },
            isSyncing: { $ne: true },
            'audit.createdAt': { $gte: startOfToday },
            'call.status': { $in: ['initiated', 'ringing', 'in_progress'] },
            $or: [
                { 'recording.url': null },
                { 'recording.url': '' },
                { 'recording.url': { $exists: false } }
            ]
        });

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
                const config = await callingApiService.getConfig();
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

                // Sync timing (StartTime -> initiatedAt, EndTime -> endedAt)
                if (details.startTime && !callLog.call.initiatedAt) {
                    callLog.call.initiatedAt = new Date(details.startTime);
                    updated = true;
                }
                if (details.endTime && !callLog.call.endedAt) {
                    callLog.call.endedAt = new Date(details.endTime);
                    updated = true;
                }
                
                // Calculate answeredAt if we have duration and end time but no answered time
                if (callLog.call.endedAt && callLog.call.duration > 0 && !callLog.call.answeredAt) {
                    callLog.call.answeredAt = new Date(callLog.call.endedAt.getTime() - (callLog.call.duration * 1000));
                    updated = true;
                }

                // Sync recording URL
                if (details.recordingUrl && (!callLog.recording.url)) {
                    console.log(`[CRON] Recording recovered for Call SID: ${callSid}. Downloading from Exotel...`);
                    try {
                        let authOptions = undefined;
                        if (config.provider === 'exotel') {
                            authOptions = { username: config.apiKey, password: config.apiToken };
                        } else if (config.provider === 'twilio') {
                            authOptions = { username: config.accountSid, password: config.authToken };
                        }
                        const response = await axios.get(details.recordingUrl, {
                            responseType: 'arraybuffer',
                            auth: authOptions,
                        });
                        console.log(`✅ [CRON] Recording downloaded, size: ${response.data.byteLength} bytes`);
                        const buffer = Buffer.from(response.data);
                        const objectKey = `tenants/${callLog.tenantId}/users/${callLog.userId}/leads/${callLog.leadId}/recordings/${callSid}.mp3`;
                        await uploadBufferToR2(buffer, objectKey, 'audio/mpeg');
                        callLog.isSyncing = true;
                        callLog.recording.url = details.recordingUrl;
                        callLog.recording.objectKey = objectKey;
                        callLog.recording.mimeType = 'audio/mpeg';
                        callLog.recording.status = 'available';
                        callLog.recording.fetchedAt = new Date();
                        updated = true;
                        console.log(`✅ [CRON] Uploaded recording to R2 for Call SID: ${callSid}`);
                    } catch (uploadError) {
                        console.error(`❌ [CRON] Failed to download/upload recording for Call SID: ${callSid}`, uploadError.message);
                        // Fallback to the exotel URL if upload fails
                        if (!callLog.recording.url) {
                            callLog.recording.url = details.recordingUrl;
                            callLog.recording.status = 'ready';
                            callLog.recording.fetchedAt = new Date();
                            updated = true;
                        }
                    } finally {
                        callLog.isSyncing = false;
                    }
                }

                if (updated) {
                    await callLog.save();
                    
                    // if (callLog.call.status === 'completed' && !callLog.events.processed?.includes('CALL_COMPLETED')) {
                    //     await publishEvent(EVENTS.CALL_COMPLETED, {
                    //         tenantId: callLog.tenantId,
                    //         callId: callLog._id,
                    //         leadId: callLog.leadId,
                    //         userId: callLog.userId,
                    //         duration: callLog.call.duration,
                    //     });
                    //     callLog.events.processed.push('CALL_COMPLETED');
                    //     await callLog.save();
                    // }

                    // if (callLog.recording.status === 'ready' && !callLog.events.processed?.includes('CALL_RECORDING_READY')) {
                    //     await publishEvent('CALL_RECORDING_READY', {
                    //         tenantId: callLog.tenantId,
                    //         callId: callLog._id,
                    //         callSid: callSid,
                    //         recordingUrl: details.recordingUrl,
                    //         userId: callLog.userId
                    //     });
                    //     callLog.events.processed.push('CALL_RECORDING_READY');
                    //     await callLog.save();
                    // }
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
    // Run every 5 minutes
    // cron.schedule('*/5 * * * *', () => {
    //     syncMissingRecordings().catch(console.error);
    // });
    console.log('✅ call-service: Cron jobs registered');
};

module.exports = {
    registerCronJobs,
    syncMissingRecordings
};
