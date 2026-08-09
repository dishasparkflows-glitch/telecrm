const test = require('node:test');
const assert = require('node:assert/strict');
const Lead = require('../src/models/Lead');
const LeadActivity = require('../src/models/LeadActivity');
const { createOrUpdateLeadFromSource } = require('../src/services/leadIngestion.service');

test('createOrUpdateLeadFromSource safely handles leadData without lifecycle', async (t) => {
    const originalFindOne = Lead.findOne;
    const originalCreate = Lead.create;
    const originalActivityCreate = LeadActivity.create;

    let createdPayload = null;

    Lead.findOne = async () => null;
    Lead.create = async (payload) => {
        createdPayload = payload;
        return {
            ...payload,
            _id: '64b000000000000000000099',
            save: async () => {},
        };
    };
    LeadActivity.create = async () => ({});

    t.after(() => {
        Lead.findOne = originalFindOne;
        Lead.create = originalCreate;
        LeadActivity.create = originalActivityCreate;
    });

    const result = await createOrUpdateLeadFromSource({
        tenantId: '64b000000000000000000001',
        source: 'manual',
        leadData: {
            contact: { email: 'test@example.com', phone: '9876543210' },
            // lifecycle is deliberately omitted to test optional chaining
        },
        assignedTo: '64b000000000000000000003',
        publishCreatedEvent: false,
    });

    assert.equal(result.created, true);
    assert.equal(createdPayload.lifecycle.expectedValue, 0);
    assert.equal(createdPayload.lifecycle.priority, 'medium');
    assert.equal(createdPayload.lifecycle.followUpAt, null);
});
