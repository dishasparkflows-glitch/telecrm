const crypto = require('crypto');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client, uploadBufferToR2 } = require('@sparkcrm/shared-utils');
const { env } = require('@sparkcrm/shared-config');

const createInvoiceObjectKey = (invoice) => (
    `private-invoices/${invoice.tenantId}/${crypto.randomUUID()}.pdf`
);

const uploadPrivateInvoice = async (buffer, invoice) => {
    const objectKey = createInvoiceObjectKey(invoice);
    await uploadBufferToR2(buffer, objectKey, 'application/pdf');
    return objectKey;
};

const createInvoiceDownloadUrl = async (objectKey, expiresIn = 300) => {
    if (!objectKey) return null;
    return getSignedUrl(getR2Client(), new GetObjectCommand({
        Bucket: env.CLOUDFLARE_BUCKET_NAME,
        Key: objectKey,
        ResponseContentDisposition: 'attachment; filename="invoice.pdf"',
    }), { expiresIn });
};

module.exports = {
    uploadPrivateInvoice,
    createInvoiceDownloadUrl,
};
