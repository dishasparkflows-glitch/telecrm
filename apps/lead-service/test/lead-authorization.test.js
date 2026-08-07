const test = require('node:test');
const assert = require('node:assert/strict');

const Lead = require('../src/models/Lead');
const leadController = require('../src/controllers/lead.controller');
const {
    pickLeadCreateInput,
    pickLeadUpdateInput,
    applyAssignedToFilter,
} = require('../src/utils/leadDto');

const TENANT_ID = '64b000000000000000000001';
const BRANCH_ID = '64b000000000000000000002';
const USER_ID = '64b000000000000000000003';
const OTHER_USER_ID = '64b000000000000000000004';
const LEAD_ID = '64b000000000000000000005';

function ownOnlyHeaders() {
    return {
        'x-tenant-id': TENANT_ID,
        'x-user-id': USER_ID,
        'x-user-role': 'agent',
        'x-user-branch-id': BRANCH_ID,
        'x-user-permissions': JSON.stringify({ leads: { isOwn: true, isGlobal: false } }),
    };
}

function invokeExpectingError(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            status() { return this; },
            json() { reject(new Error('Expected request to be rejected')); },
        };
        handler(req, res, (error) => {
            if (!error) return reject(new Error('Expected an error'));
            resolve(error);
        });
    });
}

test('create and import DTOs reject protected lead fields', () => {
    for (const field of ['tenantId', 'branchId', 'assignedTo', 'score', 'externalIdentities', 'notes', 'isArchived']) {
        assert.throws(
            () => pickLeadCreateInput({ firstName: 'Safe', [field]: 'attacker-controlled' }),
            (error) => error.statusCode === 400 && error.message.includes(field)
        );
    }
});

test('update DTO rejects assignment, provenance, and system-managed fields', () => {
    for (const field of ['assignedTo', 'branchId', 'source', 'sourceDetails', 'score', 'scoreBreakdown', 'lastActivityAt', 'isArchived']) {
        assert.throws(
            () => pickLeadUpdateInput({ firstName: 'Safe', [field]: 'attacker-controlled' }),
            (error) => error.statusCode === 400 && error.message.includes(field)
        );
    }
});

test('lead DTOs preserve fields used by the dashboard and validate nested input', () => {
    const update = {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.test',
        phone: '919876543210',
        company: 'Analytical Engines',
        expectedValue: 5000,
        followUpAt: '2026-08-05T10:00:00.000Z',
        customFields: { segment: 'enterprise' },
        address: { city: 'London', country: 'UK' },
    };
    assert.deepEqual(pickLeadUpdateInput(update), update);
    assert.deepEqual(pickLeadCreateInput({ ...update, stage: 'new', source: 'manual' }), {
        ...update,
        stage: 'new',
        source: 'manual',
    });
    assert.throws(() => pickLeadUpdateInput({ address: { tenantId: TENANT_ID } }), /Unsupported address fields/);
    assert.throws(() => pickLeadUpdateInput({ customFields: [] }), /customFields must be an object/);
});

test('an own-only lead filter cannot be changed to another assignee', () => {
    const scope = { tenantId: TENANT_ID, branchId: BRANCH_ID, assignedTo: USER_ID };
    assert.throws(
        () => applyAssignedToFilter(scope, OTHER_USER_ID),
        (error) => error.statusCode === 403
    );
    assert.equal(applyAssignedToFilter(scope, USER_ID).assignedTo, USER_ID);

    const globalScope = { tenantId: TENANT_ID, branchId: BRANCH_ID };
    assert.equal(applyAssignedToFilter(globalScope, OTHER_USER_ID).assignedTo, OTHER_USER_ID);
});

test('detail, note, and assignment handlers deny another agent lead before mutation', async (t) => {
    const originalFindOne = Lead.findOne;
    let saveCalls = 0;
    const inaccessibleLead = {
        _id: LEAD_ID,
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        assignedTo: OTHER_USER_ID,
        notes: [],
        async save() { saveCalls += 1; },
    };
    Lead.findOne = async () => inaccessibleLead;
    t.after(() => { Lead.findOne = originalFindOne; });

    const requests = [
        [leadController.getLead, { headers: ownOnlyHeaders(), params: { id: LEAD_ID }, query: {}, body: {} }],
        [leadController.addNote, { headers: ownOnlyHeaders(), params: { id: LEAD_ID }, query: {}, body: { text: 'private note' } }],
        [leadController.assignLead, { headers: ownOnlyHeaders(), params: { id: LEAD_ID }, query: {}, body: { assignedTo: USER_ID } }],
    ];

    for (const [handler, req] of requests) {
        const error = await invokeExpectingError(handler, req);
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /do not have access/i);
    }
    assert.equal(inaccessibleLead.notes.length, 0);
    assert.equal(inaccessibleLead.assignedTo, OTHER_USER_ID);
    assert.equal(saveCalls, 0);
});
