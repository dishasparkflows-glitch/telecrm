const test = require('node:test');
const assert = require('node:assert/strict');
const { getTemplate, sanitizeTemplateData } = require('../src/templates/emailTemplates');

test('escapes untrusted template data', () => {
    const data = sanitizeTemplateData({ companyName: '<img src=x>', resetUrl: 'javascript:alert(1)' });
    assert.equal(data.companyName, '&lt;img src=x&gt;');
    assert.equal(data.resetUrl, '#');
});

test('renders HTTPS reset links only', () => {
    const rendered = getTemplate('password_reset', { resetUrl: 'https://example.com/reset?a=1&b=2' });
    assert.match(rendered.html, /https:\/\/example\.com\/reset/);
    assert.doesNotMatch(rendered.html, /javascript:/i);
});
