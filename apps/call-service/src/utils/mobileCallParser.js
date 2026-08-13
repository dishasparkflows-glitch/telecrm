const { CALL_STATUS } = require('@sparkcrm/shared-utils');

const MOBILE_CALL_TYPES = {
    incoming: { direction: 'inbound', status: CALL_STATUS.COMPLETED },
    outgoing: { direction: 'outbound', status: CALL_STATUS.COMPLETED },
    missed: { direction: 'inbound', status: CALL_STATUS.MISSED },
    rejected: { direction: 'inbound', status: CALL_STATUS.MISSED },
    blocked: { direction: 'inbound', status: CALL_STATUS.FAILED },
};

const normalizeMobileCallEntry = (entry = {}) => {
    const externalCallId = String(entry.deviceCallId || '').trim();
    const remoteNumber = String(entry.phone || entry.remoteNumber || '').trim();
    const type = MOBILE_CALL_TYPES[String(entry.type || '').toLowerCase()];
    if (!externalCallId || !remoteNumber || !type) throw new Error('deviceCallId, phone, and a valid call type are required');

    const startedAt = new Date(entry.startedAt || entry.timestamp);
    if (Number.isNaN(startedAt.getTime())) throw new Error('A valid startedAt timestamp is required');

    return {
        externalCallId,
        remoteNumber,
        type,
        startedAt,
        duration: Math.max(0, Number(entry.duration) || 0),
    };
};

module.exports = {
    MOBILE_CALL_TYPES,
    normalizeMobileCallEntry
};
