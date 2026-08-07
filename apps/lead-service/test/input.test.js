const test = require('node:test');
const assert = require('node:assert/strict');
const { pagination, normalizeEmail, normalizePhone, escapeRegex } = require('../src/utils/input');

test('normalizes lead contact identifiers', () => {
    assert.equal(normalizeEmail(' Test@Example.COM '), 'test@example.com');
    assert.equal(normalizePhone('+91 98765-43210'), '919876543210');
    assert.equal(normalizePhone('9876543210'), '919876543210');
    assert.throws(() => normalizeEmail('not-an-email'));
    assert.throws(() => normalizePhone('123'));
});

test('bounds pagination and escapes regex searches', () => {
    assert.deepEqual(pagination({ page: '2', limit: '25' }), { page: 2, limit: 25, skip: 25 });
    assert.throws(() => pagination({ page: '1', limit: '101' }));
    assert.equal(escapeRegex('a.*b'), 'a\\.\\*b');
});
