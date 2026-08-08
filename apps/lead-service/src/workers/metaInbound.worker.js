const { InboundLeadEvent } = require('../models/LeadSourceModels');
const { extractLeadChanges } = require('../services/metaLeadAds.service');
const { processStoredMetaEvent } = require('../controllers/leadSource.controller');

const STALE_PROCESSING_MS = 2 * 60_000;
const DEFAULT_BATCH_SIZE = 20;

const buildChangeFromEvent = (event) => {
    const changes = extractLeadChanges(event.rawPayload || {});
    const matchingChange = changes.find((change) => change.externalLeadId === event.externalLeadId);
    if (matchingChange) return matchingChange;

    return {
        externalLeadId: event.externalLeadId,
        externalPageId: event.externalPageId,
        externalFormId: event.externalFormId,
        adId: '',
        createdTime: null,
    };
};

const claimNextEvent = async () => {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
    return InboundLeadEvent.findOneAndUpdate(
        {
            provider: 'meta_lead_ads',
            $or: [
                { status: 'received' },
                { status: 'processing', processingAt: { $lte: staleBefore } },
            ],
        },
        {
            $set: {
                status: 'processing',
                processingAt: new Date(),
                error: '',
            },
        },
        { new: true, sort: { 'createdAt': 1 } }
    );
};

const processNextEvent = async () => {
    const event = await claimNextEvent();
    if (!event) return false;

    const change = buildChangeFromEvent(event);
    await processStoredMetaEvent({ event, change, rawPayload: event.rawPayload });
    return true;
};

const processMetaInboundBatch = async (limit = DEFAULT_BATCH_SIZE) => {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_BATCH_SIZE, 100));
    let processed = 0;
    while (processed < boundedLimit && await processNextEvent()) processed += 1;
    return processed;
};

const registerMetaInboundWorker = () => {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            await processMetaInboundBatch();
        } catch (error) {
            console.error('Meta inbound lead worker failed:', error.message);
        } finally {
            running = false;
        }
    };

    run();
    const timer = setInterval(run, 2_000);
    timer.unref?.();
    return timer;
};

module.exports = {
    buildChangeFromEvent,
    claimNextEvent,
    processNextEvent,
    processMetaInboundBatch,
    registerMetaInboundWorker,
};
