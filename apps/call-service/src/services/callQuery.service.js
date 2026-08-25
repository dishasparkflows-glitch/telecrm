const CallLog = require('../models/CallLog');
const { getPresignedDownloadUrl } = require('@sparkcrm/shared-utils');
const { getLeadsBulk } = require('./serviceClients/lead.client');
const { getUsersBulk } = require('./serviceClients/user.client');
const { getBranchesBulk } = require('./serviceClients/branch.client');

const getEnrichedCallLogs = async (filter, skip, limit, tenantId) => {
    // 1. Fetch CallLogs
    const [dbLogs, total] = await Promise.all([
        CallLog.find(filter)
            .sort({ 'audit.createdAt': -1 })
            .skip(skip)
            .limit(limit),
        CallLog.countDocuments(filter),
    ]);

    if (dbLogs.length === 0) {
        return { logs: [], total };
    }

    // 2. Extract unique IDs
    const leadIds = [...new Set(dbLogs.map(log => log.leadId).filter(Boolean).map(String))];
    const userIds = [...new Set(dbLogs.map(log => log.userId).filter(Boolean).map(String))];
    const branchIds = [...new Set(dbLogs.map(log => log.branchId).filter(Boolean).map(String))];

    // 3. Fetch in parallel gracefully
    const [leadsResult, usersResult, branchesResult] = await Promise.allSettled([
        getLeadsBulk(tenantId, leadIds),
        getUsersBulk(tenantId, userIds),
        getBranchesBulk(tenantId, branchIds)
    ]);

    const leads = leadsResult.status === 'fulfilled' ? leadsResult.value : [];
    const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
    const branches = branchesResult.status === 'fulfilled' ? branchesResult.value : [];

    // 4. Create lookup maps
    const leadMap = new Map(leads.map(lead => [String(lead._id), lead]));
    const userMap = new Map(users.map(user => [String(user._id), user]));
    const branchMap = new Map(branches.map(branch => [String(branch._id), branch]));

    // 5. Enrich CallLogs
    const enrichedLogs = await Promise.all(
        dbLogs.map(async log => {
            const obj = log.toObject();
            let playbackUrl = obj.recording?.url || null;
            let downloadUrl = playbackUrl;
            if (obj.recording?.objectKey) {
                try {
                    playbackUrl = await getPresignedDownloadUrl(obj.recording.objectKey);
                    
                    const lead = leadMap.get(String(obj.leadId));
                    const leadName = lead ? `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() : '';
                    let dateStr = '';
                    if (obj.audit?.createdAt) {
                        const date = new Date(obj.audit.createdAt);
                        dateStr = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
                    }
                    let downloadFilename = `${leadName}_${dateStr}`.replace(/[\s\/]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    if (!downloadFilename) downloadFilename = 'recording';
                    downloadFilename += '.mp3';
                    
                    downloadUrl = await getPresignedDownloadUrl(obj.recording.objectKey, 86400, downloadFilename);
                } catch {
                    playbackUrl = obj.recording?.url || null;
                    downloadUrl = playbackUrl;
                }
            }
            
            return {
                _id: obj._id,
                tenantId: obj.tenantId,
                               
                leadId: leadMap.get(String(obj.leadId)) || null,
                userId: userMap.get(String(obj.userId)) || null,
                branchId: branchMap.get(String(obj.branchId)) || null,
                
                call: obj.call,
                callbackAt: obj.callbackAt,
                provider: {
                    name: obj.provider?.name,
                    externalCallId: obj.provider?.externalCallId
                },
                recording: {
                    status: obj.recording?.status,
                    mimeType: obj.recording?.mimeType,
                    duration: obj.recording?.duration,
                    playbackUrl,
                    downloadUrl,
                },
                disposition: obj.disposition,
                audit: { createdAt: obj.audit?.createdAt },
            };
        })
    );

    return { logs: enrichedLogs, total };
};

module.exports = { getEnrichedCallLogs };
