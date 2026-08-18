const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScopeFilter, canAccessRecord } = require('../src/dataScope');

function request(overrides = {}) {
    return { headers: {
        'x-tenant-id': 'tenant-1',
        'x-user-id': 'user-1',
        'x-user-role': 'agent',
        'x-user-branch-id': 'branch-1',
        'x-user-permissions': JSON.stringify({ leads: { isOwn: true, isGlobal: false } }),
        ...overrides,
    } };
}

test('own scope includes tenant, branch, and owner', () => {
    assert.deepEqual(buildScopeFilter(request(), { module: 'leads', ownerField: 'assignedTo' }), {
        tenantId: 'tenant-1', branchId: 'branch-1', assignedTo: 'user-1',
    });
});

test('missing branch and no-visibility permissions deny by default', () => {
    assert.throws(() => buildScopeFilter(request({ 'x-user-branch-id': '' }), { module: 'leads' }), /branch/i);
    assert.throws(() => buildScopeFilter(request({
        'x-user-permissions': JSON.stringify({ leads: { isOwn: false, isGlobal: false } }),
    }), { module: 'leads' }), /visibility/i);
});

test('missing identity or verified module permissions deny by default', () => {
    assert.throws(() => buildScopeFilter(request({ 'x-tenant-id': '' }), { module: 'leads' }), /tenant/i);
    assert.throws(() => buildScopeFilter(request({ 'x-user-id': '' }), {
        module: 'leads', ownerField: 'assignedTo',
    }), /user context/i);
    assert.throws(() => buildScopeFilter(request({ 'x-user-permissions': '' }), { module: 'leads' }), /permissions/i);
    assert.throws(() => buildScopeFilter(request({ 'x-user-permissions': '{invalid' }), { module: 'leads' }), /permissions/i);
    assert.throws(() => buildScopeFilter(request({
        'x-user-permissions': JSON.stringify({ calls: { isOwn: true, isGlobal: false } }),
    }), { module: 'leads' }), /permissions/i);
});

test('branch visibility remains tenant and branch scoped', () => {
    assert.deepEqual(buildScopeFilter(request({
        'x-user-permissions': JSON.stringify({ leads: { isOwn: false, isBranch: true, isGlobal: false } }),
    }), { module: 'leads', ownerField: 'assignedTo' }), {
        tenantId: 'tenant-1', branchId: 'branch-1',
    });
});

test('global visibility is tenant scoped only', () => {
    assert.deepEqual(buildScopeFilter(request({
        'x-user-permissions': JSON.stringify({ leads: { isOwn: false, isBranch: false, isGlobal: true } }),
    }), { module: 'leads', ownerField: 'assignedTo' }), {
        tenantId: 'tenant-1',
    });
});

test('superadmin visibility requires a tenant and honors a selected branch', () => {
    const { ROLES } = require('../src/constants');
    const superadmin = request({
        'x-user-role': ROLES.SUPER_ADMIN,
        'x-user-id': '',
        'x-user-branch-id': '',
        'x-user-permissions': '',
        'x-branch-id': 'branch-2',
    });
    assert.deepEqual(buildScopeFilter(superadmin, { module: 'leads' }), {
        tenantId: 'tenant-1', branchId: 'branch-2',
    });
    assert.throws(() => buildScopeFilter(request({
        'x-user-role': ROLES.SUPER_ADMIN, 'x-tenant-id': '',
    }), { module: 'leads' }), /tenant/i);
});

test('record access rejects tenant and branch mismatches', () => {
    assert.equal(canAccessRecord(request(), {
        tenantId: 'tenant-1', branchId: 'branch-1', assignedTo: 'user-1',
    }, { module: 'leads', ownerField: 'assignedTo' }), true);
    assert.equal(canAccessRecord(request(), {
        tenantId: 'tenant-2', branchId: 'branch-1', assignedTo: 'user-1',
    }, { module: 'leads', ownerField: 'assignedTo' }), false);
    assert.equal(canAccessRecord(request(), {
        tenantId: 'tenant-1', branchId: 'branch-2', assignedTo: 'user-1',
    }, { module: 'leads', ownerField: 'assignedTo' }), false);
});

test('record access fails closed when scope context is incomplete or denied', () => {
    const record = { tenantId: 'tenant-1', branchId: 'branch-1', assignedTo: 'user-1' };
    assert.equal(canAccessRecord(request({ 'x-tenant-id': '' }), record, {
        module: 'leads', ownerField: 'assignedTo',
    }), false);
    assert.equal(canAccessRecord(request({ 'x-user-branch-id': '' }), record, {
        module: 'leads', ownerField: 'assignedTo',
    }), false);
    assert.equal(canAccessRecord(request({ 'x-user-permissions': '' }), record, {
        module: 'leads', ownerField: 'assignedTo',
    }), false);
    assert.equal(canAccessRecord(request({
        'x-user-permissions': JSON.stringify({ leads: { isOwn: false, isGlobal: false } }),
    }), record, { module: 'leads', ownerField: 'assignedTo' }), false);
});
