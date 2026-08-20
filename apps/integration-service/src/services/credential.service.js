const crypto = require('crypto');
const { env } = require('@sparkcrm/shared-config');

const ENCRYPTION_VERSION = 'v2';
const IV_LENGTH = 12;

function encryptionKey() {
    const configuredKey = env.ENCRYPTION_KEY;
    if (!configuredKey || configuredKey.length < 32) {
        throw new Error('ENCRYPTION_KEY must contain at least 32 characters');
    }
    return crypto.createHash('sha256').update(configuredKey, 'utf8').digest();
}

function encrypt(text) {
    if (text === null || text === undefined || text === '') return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [ENCRYPTION_VERSION, iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decrypt(text) {
    if (!text) return '';
    if (typeof text !== 'string') throw new Error('Invalid encrypted credential');

    const [version, ivHex, tagHex, encryptedHex, ...extra] = text.split(':');
    if (version !== ENCRYPTION_VERSION || extra.length ||
        !/^[a-f\d]{24}$/i.test(ivHex || '') ||
        !/^[a-f\d]{32}$/i.test(tagHex || '') ||
        !/^(?:[a-f\d]{2})+$/i.test(encryptedHex || '')) {
        throw new Error('Invalid encrypted credential');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}

module.exports = {
    encrypt,
    decrypt,
};
