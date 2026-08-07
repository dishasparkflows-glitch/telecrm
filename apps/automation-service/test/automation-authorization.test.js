const test = require('node:test');
const assert = require('node:assert/strict');

const { AutomationRule, AutomationLog } = require('../src/models/AutomationRule');
const { pickRuleWriteInput, pagination } = require('../src/utils/automationDto');
const { getLogs } = require('../src/controllers/automation.controller');

const TENANT_ID = '64d000000000000000000001';
const BRANCH_ID = '64d000000000000000000002';
const USER_ID = '64d000000000000000000003';
const RULE_ID = '64d000000000000000000004';

function ownOnlyHeaders() {
    return {
        'x-tenant-id': TENANT_ID,
        'x-user-id': USER_ID,
        'x-user-role': 'agent',
        'x-user-branch-id': BRANCH_ID,
        'x-user-permissions': JSON.stringify({ automations: { isOwn: true, isGlobal: false } }),
    };
}

function invoke(handler, req) {
    return new Promise((resolve, reject) => {
        const res = {
            statusCode: null,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; resolve(this); },
        };
        handler(req, res, reject);
    });
}

test('automation DTO rejects identity, counters, active state, and timestamps', () => {
    for (const field of ['tenantId', 'branchId', 'createdBy', 'executionCount', 'lastExecutedAt', 'isActive', 'createdAt']) {
        assert.throws(
            () => pickRuleWriteInput({ name: 'Safe rule', [field]: 'attacker-controlled' }),
            (error) => error.statusCode === 400 && error.message.includes(field)
        );
    }
});

test('automation DTO preserves supported definitions and rejects nested database fields', () => {
    const input = {
        name: 'Notify hot leads',
        description: 'Notify sales when a score changes',
        trigger: {
            event: 'lead.score.changed',
            conditions: [{ field: 'score', operator: 'greater_than', value: 70 }],
        },
        actions: [{ type: 'send_notification', config: { title: 'Hot lead' }, delay: 0 }],
    };
    assert.deepEqual(pickRuleWriteInput(input), input);
    assert.throws(
        () => pickRuleWriteInput({ trigger: { event: 'lead.created', conditions: [{ _id: RULE_ID }] } }),
        /Unsupported conditions\[0\] fields/
    );
    assert.throws(
        () => pickRuleWriteInput({ actions: [{ type: 'webhook', config: [], delay: 0 }] }),
        /config must be an object/
    );
});

test('automation pagination is bounded', () => {
    assert.deepEqual(pagination({ page: '2', limit: '25' }), { page: 2, limit: 25, skip: 25 });
    assert.throws(() => pagination({ limit: '101' }), (error) => error.statusCode === 400);
});

test('own-only execution logs are restricted to rule IDs created by the user', async (t) => {
    const originalDistinct = AutomationRule.distinct;
    const originalFind = AutomationLog.find;
    const originalCountDocuments = AutomationLog.countDocuments;
    let distinctScope;
    let logFilter;

    AutomationRule.distinct = async (field, scope) => {
        assert.equal(field, '_id');
        distinctScope = scope;
        return [RULE_ID];
    };
    AutomationLog.find = (filter) => {
        logFilter = filter;
        return {
            sort() { return this; },
            skip() { return this; },
            async limit() { return []; },
        };
    };
    AutomationLog.countDocuments = async () => 0;
    t.after(() => {
        AutomationRule.distinct = originalDistinct;
        AutomationLog.find = originalFind;
        AutomationLog.countDocuments = originalCountDocuments;
    });

    const response = await invoke(getLogs, {
        headers: ownOnlyHeaders(),
        query: { page: '1', limit: '25' },
        params: {},
        body: {},
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(distinctScope, {
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        createdBy: USER_ID,
    });
    assert.deepEqual(logFilter, {
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        ruleId: { $in: [RULE_ID] },
    });
});
