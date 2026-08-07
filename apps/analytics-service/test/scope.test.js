const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalyticsFilter } = require('../src/utils/scope');

const tenantId = '507f1f77bcf86cd799439011';
const branchId = '507f1f77bcf86cd799439012';
const userId = '507f1f77bcf86cd799439013';

const request = (overrides = {}) => ({ headers: {
    'x-tenant-id': tenantId,
    'x-user-id': userId,
    'x-user-role': 'agent',
    'x-user-branch-id': branchId,
    'x-user-permissions': JSON.stringify({ leads: { isOwn: true, isGlobal: false } }),
    ...overrides,
} });

test('scopes own analytics to tenant, branch, and owner', () => {
    const filter = buildAnalyticsFilter(request(), 'assignedTo', 'leads');
    assert.equal(String(filter.tenantId), tenantId);
    assert.equal(String(filter.branchId), branchId);
    assert.equal(String(filter.assignedTo), userId);
});

test('fails closed without a verified branch or usable owner scope', () => {
    assert.throws(() => buildAnalyticsFilter(request({ 'x-user-branch-id': undefined }), 'assignedTo', 'leads'));
    assert.throws(() => buildAnalyticsFilter(request(), null, 'leads'));
});
