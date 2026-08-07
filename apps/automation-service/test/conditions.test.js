const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateConditions } = require('../src/events/eventListeners');

test('evaluates supported automation conditions', () => {
    assert.equal(evaluateConditions([{ field: 'score', operator: 'greater_than', value: 50 }], { score: 75 }), true);
    assert.equal(evaluateConditions([{ field: 'stage', operator: 'equals', value: 'won' }], { stage: 'lost' }), false);
});

test('fails closed for unknown operators', () => {
    assert.equal(evaluateConditions([{ field: 'stage', operator: 'unknown', value: 'won' }], { stage: 'won' }), false);
});
