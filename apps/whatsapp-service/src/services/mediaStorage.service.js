const crypto = require('crypto');
const { GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client, uploadBufferToR2 } = require('@sparkcrm/shared-utils');
const { env } = require('@sparkcrm/shared-config');

const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const PREVIEW_URL_TTL_SECONDS = 300;
const MEDIA_KEY_ROOT = 'private-whatsapp-media';
const TENANT_ID_PATTERN = /^[a-f\d]{24}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_MEDIA_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/opus',
    'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/3gpp',
    'application/pdf', 'text/plain', 'text/csv', 'text/rtf',
    'application/rtf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
]);

const normalizeMimeType = (mimeType) => String(mimeType || '').trim().toLowerCase().split(';')[0];

const validateMimeType = (mimeType) => {
    const normalized = normalizeMimeType(mimeType);
    if (!ALLOWED_MEDIA_TYPES.has(normalized)) throw new Error('Unsupported media MIME type');
    return normalized;
};

const validateMediaSize = (size) => {
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Media file is empty');
    if (size > MAX_MEDIA_BYTES) throw new Error('Media file exceeds the 15MB limit');
    return size;
};

const decodeBase64Media = (data) => {
    if (typeof data !== 'string' || !data.length) throw new Error('Base64 media data is required');
    const value = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
    const compact = value.replace(/\s/g, '');
    if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
        throw new Error('Invalid base64 media data');
    }
    const buffer = Buffer.from(compact, 'base64');
    validateMediaSize(buffer.length);
    if (buffer.toString('base64').replace(/=+$/, '') !== compact.replace(/=+$/, '')) {
        throw new Error('Invalid base64 media data');
    }
    return buffer;
};

const createObjectKey = (tenantId) => {
    const tenant = String(tenantId || '');
    if (!TENANT_ID_PATTERN.test(tenant)) throw new Error('Valid tenantId is required');
    return `${MEDIA_KEY_ROOT}/${tenant}/${crypto.randomUUID()}`;
};

const validateTenantObjectKey = (objectKey, tenantId) => {
    const tenant = String(tenantId || '');
    if (!TENANT_ID_PATTERN.test(tenant) || typeof objectKey !== 'string') return false;
    const parts = objectKey.split('/');
    return parts.length === 3 && parts[0] === MEDIA_KEY_ROOT && parts[1] === tenant && UUID_PATTERN.test(parts[2]);
};

const assertTenantObjectKey = (objectKey, tenantId) => {
    if (!validateTenantObjectKey(objectKey, tenantId)) throw new Error('Invalid media object key for tenant');
    return objectKey;
};

const sanitizeMediaName = (name) => {
    const value = String(name || 'media').replace(/[\r\n\0]/g, '').trim();
    return value.slice(0, 255) || 'media';
};

const uploadPrivateMedia = async ({ buffer, tenantId, mimeType }) => {
    validateMediaSize(buffer?.length);
    const normalizedMimeType = validateMimeType(mimeType);
    const objectKey = createObjectKey(tenantId);
    await uploadBufferToR2(buffer, objectKey, normalizedMimeType);
    return objectKey;
};

const assertMediaExists = async (objectKey, tenantId) => {
    assertTenantObjectKey(objectKey, tenantId);
    return getR2Client().send(new HeadObjectCommand({ Bucket: env.CLOUDFLARE_BUCKET_NAME, Key: objectKey }));
};

const createSignedMediaUrl = async (objectKey, tenantId, options = {}) => {
    assertTenantObjectKey(objectKey, tenantId);
    const mimeType = options.mimeType ? validateMimeType(options.mimeType) : undefined;
    const disposition = options.download ? 'attachment' : 'inline';
    const filename = sanitizeMediaName(options.name);
    return getSignedUrl(getR2Client(), new GetObjectCommand({
        Bucket: env.CLOUDFLARE_BUCKET_NAME,
        Key: objectKey,
        ...(mimeType ? { ResponseContentType: mimeType } : {}),
        ResponseContentDisposition: `${disposition}; filename="${filename.replace(/["\\]/g, '_')}"`,
    }), { expiresIn: options.expiresIn || PREVIEW_URL_TTL_SECONDS });
};

module.exports = {
    ALLOWED_MEDIA_TYPES,
    MAX_MEDIA_BYTES,
    PREVIEW_URL_TTL_SECONDS,
    assertMediaExists,
    assertTenantObjectKey,
    createObjectKey,
    createSignedMediaUrl,
    decodeBase64Media,
    normalizeMimeType,
    sanitizeMediaName,
    uploadPrivateMedia,
    validateMediaSize,
    validateMimeType,
    validateTenantObjectKey,
};
