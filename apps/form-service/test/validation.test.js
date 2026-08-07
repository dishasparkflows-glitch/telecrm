const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission } = require('../src/controllers/form.controller');

const form = { fields: [
    { name: 'email', label: 'Email', type: 'email', required: true, options: [] },
    { name: 'size', label: 'Size', type: 'dropdown', required: false, options: ['small', 'large'] },
    { name: 'consent', label: 'Consent', type: 'checkbox', required: false, options: [] },
    { name: 'date', label: 'Date', type: 'date', required: false, options: [] },
] };

test('validates and strips form submissions against declared fields', () => {
    assert.deepEqual(validateSubmission(form, { email: 'a@example.com', size: 'small' }), { email: 'a@example.com', size: 'small' });
    assert.throws(() => validateSubmission(form, { email: 'bad' }), (error) => error.statusCode === 400);
    assert.throws(() => validateSubmission(form, { email: 'a@example.com', unexpected: true }), (error) => error.statusCode === 400);
    assert.throws(() => validateSubmission(form, { email: 'a@example.com', consent: 'yes' }), (error) => error.statusCode === 400);
    assert.throws(() => validateSubmission(form, { email: 'a@example.com', date: 'not-a-date' }), (error) => error.statusCode === 400);
    assert.throws(() => validateSubmission(form, null), (error) => error.statusCode === 400);
});
