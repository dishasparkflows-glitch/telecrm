const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveDateRange } = require('../src/utils/dateRange');

test('converts explicit analytics boundaries to Dates', () => {
    const range = resolveDateRange({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T23:59:59.000Z' });
    assert.equal(range.$gte.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(range.$lte.toISOString(), '2026-01-31T23:59:59.000Z');
});

test('converts named ranges relative to an explicit end date', () => {
    const range = resolveDateRange({ range: '7d', to: '2026-02-08T00:00:00.000Z' });
    assert.equal(range.$gte.toISOString(), '2026-02-01T00:00:00.000Z');
    assert.equal(range.$lte.toISOString(), '2026-02-08T00:00:00.000Z');
    assert.equal(resolveDateRange({ range: 'unsupported', to: '2026-02-08' }), null);
});
