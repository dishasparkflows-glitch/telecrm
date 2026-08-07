const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const loadHelpers = (filename) => {
    const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    const cutoff = filename === 'content.js' ? source.indexOf('const detectActiveChat') : source.indexOf('const requestHostPermission');
    const sandbox = { module: { exports: {} }, document: { getElementById() {} } };
    vm.runInNewContext(source.slice(0, cutoff), sandbox);
    return sandbox.module.exports;
};

test('normalizes extension popup phone input without losing a leading plus', () => {
    const { normalizePhone, normalizeBase } = loadHelpers('popup.js');
    assert.equal(normalizePhone(' +91 (987) 654-3210 '), '+919876543210');
    assert.equal(normalizePhone('abc'), '');
    assert.equal(normalizeBase(' https://crm.example.test/// '), 'https://crm.example.test');
});

test('extracts valid phone candidates from WhatsApp chat labels', () => {
    const { normalizeCandidate } = loadHelpers('content.js');
    assert.equal(normalizeCandidate('Chat with +91 (987) 654-3210'), '+919876543210');
    assert.equal(normalizeCandidate('short 1234567'), '');
    assert.equal(normalizeCandidate('Customer Name'), '');
});
