const test = require('node:test');
const assert = require('node:assert/strict');
const { validateWelcomeRequest, buildTemplateComponents } = require('../src/events/eventListeners');

const base = { tenantId: 't', leadId: 'l', phone: '+911234567890', templateName: 'welcome', idempotencyKey: 'meta-welcome:t:l' };

test('requires explicit WhatsApp consent by default', () => {
    assert.deepEqual(validateWelcomeRequest(base), { ok: false, reason: 'consent' });
    assert.deepEqual(validateWelcomeRequest({ ...base, consent: { whatsappOptIn: true } }), { ok: true, reason: null });
    assert.deepEqual(validateWelcomeRequest({ ...base, consentRequired: false }), { ok: true, reason: null });
});

test('requires an idempotency key before queuing welcome delivery', () => {
    assert.deepEqual(validateWelcomeRequest({ ...base, idempotencyKey: '', consentRequired: false }), { ok: false, reason: 'incomplete' });
});

test('builds ordered template parameters with data and example fallbacks', () => {
    const components = buildTemplateComponents({ variables: [
        { index: 2, field: 'company', example: 'Example Co' },
        { index: 1, field: 'name', example: 'Customer' },
    ] }, { name: 'Asha' });
    assert.deepEqual(components[0].parameters, [
        { type: 'text', text: 'Asha' },
        { type: 'text', text: 'Example Co' },
    ]);
});
