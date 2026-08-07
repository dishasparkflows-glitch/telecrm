/**
 * Email validation utility
 * - Strong RFC-compliant regex
 * - Disposable/temporary email domain blocklist
 */

// Strong email regex — covers standard email formats, rejects obviously fake patterns
const EMAIL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;

// Phone regex — Indian format (+91 or 0 prefix, 10 digits)
const PHONE_REGEX = /^(\+91[\s-]?)?[6-9]\d{9}$/;

// Disposable / temporary email domain blocklist
const BLOCKED_DOMAINS = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
    'yopmail.com', 'sharklasers.com', 'guerrillamail.info', 'grr.la',
    'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
    'guerrillamail.org', 'guerrillamailblock.com', 'pokemail.net',
    'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net',
    'dispostable.com', 'maildrop.cc', 'mailnesia.com',
    'tempail.com', 'tempr.email', 'temp-mail.org',
    '10minutemail.com', 'minutemail.com', 'emailondeck.com',
    'fakeinbox.com', 'getnada.com', 'harakirimail.com',
    'mailcatch.com', 'mailexpire.com', 'mailforspam.com',
    'mailhazard.com', 'mailhazard.us', 'mailmoat.com',
    'mailnator.com', 'mailscrap.com', 'mailseal.de',
    'mailtemporaire.fr', 'mailzilla.com', 'disposableemailaddresses.emailmiser.com',
    'mohmal.com', 'mt2015.com', 'mytemp.email', 'nomail.xl.cx',
    'objectmail.com', 'proxymail.eu', 'rcpt.at',
    'spamfree24.org', 'spaml.de', 'thankyou2010.com',
    'wegwerfmail.de', 'wegwerfmail.net', 'wh4f.org',
    'tmail.ws', 'tmpmail.net', 'tmpmail.org',
    'getairmail.com', 'example.com', 'test.com',
    'mailsac.com', 'burnermail.io', 'inboxbear.com',
];

/**
 * Validate email format and domain
 * @param {string} email
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return { valid: false, reason: 'Email is required' };
    }

    const trimmed = email.trim().toLowerCase();

    if (trimmed.length < 5 || trimmed.length > 254) {
        return { valid: false, reason: 'Invalid email length' };
    }

    if (!EMAIL_REGEX.test(trimmed)) {
        return { valid: false, reason: 'Invalid email format. Please enter a valid email address.' };
    }

    // Check domain blocklist
    const domain = trimmed.split('@')[1];
    if (BLOCKED_DOMAINS.includes(domain)) {
        return { valid: false, reason: 'Temporary or disposable email addresses are not allowed. Please use a valid business email.' };
    }

    return { valid: true };
};

/**
 * Validate phone number (Indian format)
 * @param {string} phone
 * @returns {{ valid: boolean, reason?: string }}
 */
const validatePhone = (phone) => {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, reason: 'Phone number is required' };
    }

    const cleaned = phone.replace(/[\s-]/g, '');

    if (!PHONE_REGEX.test(cleaned)) {
        return { valid: false, reason: 'Invalid phone number. Please enter a valid 10-digit Indian mobile number.' };
    }

    return { valid: true };
};

module.exports = { validateEmail, validatePhone, EMAIL_REGEX, PHONE_REGEX, BLOCKED_DOMAINS };
