const test = require('node:test');
const assert = require('node:assert/strict');
const { policyMatches, selectLeastLoadedAgent, roundRobinAssign, loadBasedAssign } = require('../src/services/assignment.service');

test('matches assignment policies only when every configured condition matches', () => {
    const policy = { conditions: { sources: ['website'], priorities: ['high'] } };
    assert.equal(policyMatches(policy, { source: 'website', priority: 'high' }), true);
    assert.equal(policyMatches(policy, { source: 'referral', priority: 'high' }), false);
    assert.equal(policyMatches({ conditions: {} }, {}), true);
});

test('selects the least-loaded policy agent and keeps order for ties', () => {
    assert.equal(selectLeastLoadedAgent(['a', 'b', 'c'], [{ _id: 'a', count: 4 }, { _id: 'b', count: 1 }, { _id: 'c', count: 1 }]), 'b');
    assert.equal(selectLeastLoadedAgent(['a', 'b'], []), 'a');
    assert.equal(loadBasedAssign('tenant', [{ id: 'a', leadCount: 2 }, { id: 'b', leadCount: 0 }]).id, 'b');
});

test('round-robin compatibility selection is deterministic per tenant', () => {
    const agents = ['a', 'b', 'c'];
    assert.equal(roundRobinAssign('tenant-1', agents), roundRobinAssign('tenant-1', agents));
    assert.ok(agents.includes(roundRobinAssign('tenant-1', agents)));
});
