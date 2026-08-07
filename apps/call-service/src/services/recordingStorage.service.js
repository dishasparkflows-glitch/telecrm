const crypto = require('crypto');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client, uploadBufferToR2 } = require('@sparkcrm/shared-utils');
const { env } = require('@sparkcrm/shared-config');

const ALLOWED_AUDIO_TYPES = new Set([
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/3gpp',
]);

const extensionByType = {
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/3gpp': '3gp',
};

const uploadPrivateRecording = async ({ buffer, tenantId, callId, contentType }) => {
    if (!ALLOWED_AUDIO_TYPES.has(contentType)) throw new Error('Unsupported recording audio type');
    const extension = extensionByType[contentType] || 'audio';
    const objectKey = `private-call-recordings/${tenantId}/${callId}/${crypto.randomUUID()}.${extension}`;
    await uploadBufferToR2(buffer, objectKey, contentType);
    return objectKey;
};

const createRecordingPlaybackUrl = async (objectKey, contentType, expiresIn = 300) => {
    if (!objectKey) return null;
    return getSignedUrl(getR2Client(), new GetObjectCommand({
        Bucket: env.CLOUDFLARE_BUCKET_NAME,
        Key: objectKey,
        ResponseContentType: contentType || 'audio/mpeg',
        ResponseContentDisposition: 'inline',
    }), { expiresIn });
};

module.exports = { ALLOWED_AUDIO_TYPES, uploadPrivateRecording, createRecordingPlaybackUrl };
