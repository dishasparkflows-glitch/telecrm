const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_MEDIA_BYTES,
    createObjectKey,
    decodeBase64Media,
    validateMediaSize,
    validateMimeType,
    validateTenantObjectKey,
} = require('../src/services/mediaStorage.service');

const { WhatsappMessage } = require('../src/models/WhatsappModels');

const tenantId = '507f1f77bcf86cd799439011';

test('allows common media and document MIME types only', () => {
    assert.equal(validateMimeType('IMAGE/JPEG; charset=binary'), 'image/jpeg');
    assert.equal(validateMimeType('application/pdf'), 'application/pdf');
    assert.equal(validateMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.throws(() => validateMimeType('text/html'), /Unsupported/);
    assert.throws(() => validateMimeType('image/svg+xml'), /Unsupported/);
});

test('enforces non-empty media up to 15MB', () => {
    assert.equal(validateMediaSize(1), 1);
    assert.equal(validateMediaSize(MAX_MEDIA_BYTES), MAX_MEDIA_BYTES);
    assert.throws(() => validateMediaSize(0), /empty/);
    assert.throws(() => validateMediaSize(MAX_MEDIA_BYTES + 1), /15MB/);
});

test('strictly decodes base64 and rejects oversized content', () => {
    assert.deepEqual(decodeBase64Media('data:text/plain;base64,aGVsbG8='), Buffer.from('hello'));
    assert.throws(() => decodeBase64Media('not base64!'), /Invalid base64/);
    const oversizedBase64 = Buffer.alloc(MAX_MEDIA_BYTES + 1).toString('base64');
    assert.throws(() => decodeBase64Media(oversizedBase64), /15MB/);
});

test('does not serialize private media object keys', () => {
    const message = new WhatsappMessage({
        tenantId,
        direction: 'outbound',
        from: 'business',
        to: '919876543210',
        mediaObjectKey: createObjectKey(tenantId),
    });
    assert.equal(message.toJSON().mediaObjectKey, undefined);
    assert.equal(message.toObject().mediaObjectKey, undefined);
});

test('creates opaque tenant-scoped keys without path traversal', () => {
    const key = createObjectKey(tenantId);
    assert.match(key, new RegExp(`^private-whatsapp-media/${tenantId}/[0-9a-f-]{36}$`, 'i'));
    assert.equal(validateTenantObjectKey(key, tenantId), true);
    assert.equal(validateTenantObjectKey(key, '507f1f77bcf86cd799439012'), false);
    assert.equal(validateTenantObjectKey(`private-whatsapp-media/${tenantId}/../secret`, tenantId), false);
    assert.equal(validateTenantObjectKey(`private-whatsapp-media/${tenantId}/file.pdf`, tenantId), false);
    assert.throws(() => createObjectKey('../tenant'), /tenantId/);
});
