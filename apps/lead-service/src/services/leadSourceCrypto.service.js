const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || 'sparkcrm_default_enc_key_32bytes!';
const IV_LENGTH = 16;

const keyBuffer = () => Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));

function encrypt(text) {
    if (!text) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer(), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
    if (!text || !String(text).includes(':')) return '';
    const parts = String(text).split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encrypt, decrypt };
