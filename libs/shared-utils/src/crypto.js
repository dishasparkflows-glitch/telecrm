const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
let ENCRYPTION_KEY;

function getEncryptionKey() {
    if (!ENCRYPTION_KEY) {
        const { env } = require('@sparkcrm/shared-config');
        ENCRYPTION_KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');
    }
    return ENCRYPTION_KEY;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} text - The plaintext to encrypt.
 * @returns {string} - The encrypted string in format "iv:encryptedData:authTag"
 */
function encrypt(text) {
    if (!text) return text;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypts a cipher text encrypted by the encrypt function.
 * @param {string} cipherText - The string in format "iv:encryptedData:authTag"
 * @returns {string} - The decrypted plaintext
 */
function decrypt(cipherText) {
    if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
        return cipherText; // Return as is if not encrypted
    }

    try {
        const parts = cipherText.split(':');
        if (parts.length !== 3) throw new Error('Invalid encrypted text format');

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        console.error('Decryption failed:', err.message);
        throw new Error('Failed to decrypt data');
    }
}

module.exports = {
    encrypt,
    decrypt
};
