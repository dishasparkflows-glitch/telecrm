const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { verifyMetaSignature, buildMetaOAuthUrl, extractLeadChanges } = require('../src/services/metaLeadAds.service');
const {
    hashApiKey,
    createApiKey,
    readInboundApiKey,
    processStoredMetaEvent,
    resolveActiveMetaMapping,
} = require('../src/controllers/leadSource.controller');
const {
    InboundLeadEvent,
    LeadSourceMapping,
} = require('../src/models/LeadSourceModels');

test('verifies Meta signatures over the exact raw payload', () => {
    process.env.META_APP_SECRET = 'meta-test-secret';
    const raw = Buffer.from('{"entry":[]}');
    const signature = `sha256=${crypto.createHmac('sha256', process.env.META_APP_SECRET).update(raw).digest('hex')}`;

    assert.deepEqual(verifyMetaSignature(raw, signature), { ok: true, reason: 'Invalid Meta webhook signature' });
    assert.equal(verifyMetaSignature(Buffer.from('{"entry":[1]}'), signature).ok, false);
    assert.equal(verifyMetaSignature(raw, 'sha256=short').reason, 'Invalid signature length');
    delete process.env.META_APP_SECRET;
});

test('preserves the opaque OAuth state and configured callback', () => {
    process.env.META_APP_ID = 'app-123';
    process.env.API_PUBLIC_URL = 'https://crm.example.test/';
    const url = new URL(buildMetaOAuthUrl({ state: 'opaque+/state' }));

    assert.equal(url.searchParams.get('state'), 'opaque+/state');
    assert.equal(url.searchParams.get('redirect_uri'), 'https://crm.example.test/api/leads/oauth/meta/callback');
    delete process.env.META_APP_ID;
    delete process.env.API_PUBLIC_URL;
});

test('extracts stable Meta lead IDs used for idempotency', () => {
    const changes = extractLeadChanges({ entry: [{ id: 'page-fallback', changes: [
        { field: 'ignored', value: { leadgen_id: 'skip' } },
        { field: 'leadgen', value: { leadgen_id: 42, form_id: 7 } },
    ] }] });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].externalLeadId, '42');
    assert.equal(changes[0].externalPageId, 'page-fallback');
});

test('hashes API keys deterministically and rotates to a distinct valid key', () => {
    assert.equal(hashApiKey('secret'), crypto.createHash('sha256').update('secret').digest('hex'));
    const first = createApiKey();
    const second = createApiKey();
    assert.match(first.apiKey, new RegExp(`^sparkcrm_${first.prefix}_[A-Za-z0-9_-]+$`));
    assert.notEqual(first.apiKey, second.apiKey);
    assert.notEqual(hashApiKey(first.apiKey), hashApiKey(second.apiKey));
});

test('reads bearer API keys before the fallback header', () => {
    assert.equal(readInboundApiKey({ headers: { authorization: 'Bearer primary ', 'x-sparkcrm-api-key': 'fallback' } }), 'primary');
    assert.equal(readInboundApiKey({ headers: { 'x-sparkcrm-api-key': ' fallback ' } }), 'fallback');
});

test('Meta mapping resolution refuses cross-tenant ambiguity', async (t) => {
    const originalFind = LeadSourceMapping.find;
    LeadSourceMapping.find = () => ({
        limit: async () => [
            { _id: 'mapping-1', tenantId: 'tenant-1' },
            { _id: 'mapping-2', tenantId: 'tenant-2' },
        ],
    });
    t.after(() => { LeadSourceMapping.find = originalFind; });

    const resolution = await resolveActiveMetaMapping({
        event: {},
        change: { externalPageId: 'page-1', externalFormId: 'form-1' },
    });
    assert.equal(resolution.status, 'ambiguous');
    assert.equal(resolution.mapping, null);
});

test('ambiguous Meta events are quarantined instead of routed', async (t) => {
    const originalFind = LeadSourceMapping.find;
    const originalUpdateOne = InboundLeadEvent.updateOne;
    let eventUpdate;
    LeadSourceMapping.find = () => ({
        limit: async () => [
            { _id: 'mapping-1', tenantId: 'tenant-1' },
            { _id: 'mapping-2', tenantId: 'tenant-2' },
        ],
    });
    InboundLeadEvent.updateOne = async (filter, update) => {
        eventUpdate = { filter, update };
    };
    t.after(() => {
        LeadSourceMapping.find = originalFind;
        InboundLeadEvent.updateOne = originalUpdateOne;
    });

    const result = await processStoredMetaEvent({
        event: { _id: 'event-1' },
        change: {
            externalLeadId: 'lead-1',
            externalPageId: 'page-1',
            externalFormId: 'form-1',
        },
        rawPayload: {},
    });
    assert.equal(result.status, 'failed');
    assert.match(result.error, /ambiguous/i);
    assert.deepEqual(eventUpdate.filter, { _id: 'event-1' });
    assert.equal(eventUpdate.update.$set.status, 'failed');
});

test('stored Meta events remain pinned to their tenant and mapping', async (t) => {
    const originalFindOne = LeadSourceMapping.findOne;
    let capturedFilter;
    const expectedMapping = { _id: 'mapping-1', tenantId: 'tenant-1' };
    LeadSourceMapping.findOne = async (filter) => {
        capturedFilter = filter;
        return expectedMapping;
    };
    t.after(() => { LeadSourceMapping.findOne = originalFindOne; });

    const resolution = await resolveActiveMetaMapping({
        event: { mappingId: 'mapping-1', tenantId: 'tenant-1' },
        change: { externalPageId: 'page-1', externalFormId: 'form-1' },
    });
    assert.equal(resolution.status, 'resolved');
    assert.equal(resolution.mapping, expectedMapping);
    assert.deepEqual(capturedFilter, {
        _id: 'mapping-1',
        tenantId: 'tenant-1',
        provider: 'meta_lead_ads',
        externalPageId: 'page-1',
        externalFormId: 'form-1',
        isActive: true,
    });
});

test('active Meta Page/Form ownership has a global unique constraint', () => {
    const index = LeadSourceMapping.schema.indexes()
        .find(([, options]) => options.name === 'unique_active_meta_page_form');
    assert.ok(index);
    assert.deepEqual(index[0], { provider: 1, externalPageId: 1, externalFormId: 1 });
    assert.equal(index[1].unique, true);
    assert.deepEqual(index[1].partialFilterExpression, {
        provider: 'meta_lead_ads',
        isActive: true,
    });
});
