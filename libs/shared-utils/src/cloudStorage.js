const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { env } = require('@sparkcrm/shared-config');

/**
 * Cloudflare R2 Client — lazy initialization to avoid crash if env vars are missing
 */
let _r2Client = null;

const getR2Client = () => {
    if (_r2Client) return _r2Client;

    if (!env.CLOUDFLARE_ENDPOINT || !env.CLOUDFLARE_ACCESS_KEY_ID || !env.CLOUDFLARE_ACCESS_KEY) {
        throw new Error('Cloudflare R2 credentials are not configured in .env');
    }

    _r2Client = new S3Client({
        region: 'auto',
        endpoint: env.CLOUDFLARE_ENDPOINT,
        credentials: {
            accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
            secretAccessKey: env.CLOUDFLARE_ACCESS_KEY,
        },
    });

    return _r2Client;
};

/**
 * Uploads a Buffer (like a PDF) to Cloudflare R2.
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} fileName - Destination file path/name inside the bucket.
 * @param {string} contentType - MIME type of the file (e.g., 'application/pdf').
 * @returns {Promise<string>} - The public URL to access the file.
 */
const uploadBufferToR2 = async (buffer, fileName, contentType = 'application/pdf') => {
    try {
        const client = getR2Client();

        const command = new PutObjectCommand({
            Bucket: env.CLOUDFLARE_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        });

        await client.send(command);

        // Return the public URL
        const base = (env.CLOUDFLARE_URL || '').replace(/\/+$/, '');
        return `${base}/${fileName}`;

    } catch (error) {
        console.error('❌ Error uploading to Cloudflare R2:', error.message);
        throw new Error('Failed to upload file to cloud storage');
    }
};

module.exports = {
    getR2Client,
    uploadBufferToR2,
};
