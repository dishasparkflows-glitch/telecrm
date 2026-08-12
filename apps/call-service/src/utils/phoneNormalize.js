/**
 * Phone Number Normalization Utilities
 * Provider-specific phone number formatting for Exotel and Twilio.
 */

/**
 * Normalizes Indian phone numbers for Exotel's Connect API.
 * 1. Remove non-numeric characters.
 * 2. If it starts with 91 and is 12 digits, replace 91 with 0.
 * 3. If it's a 10-digit number, prepend 0.
 * 4. If it's already 11 digits starting with 0, keep it.
 * 5. Reject invalid lengths.
 */
const normalizeExotelNumber = (number) => {
    if (!number) return '';
    let digits = String(number).replace(/\D/g, '');
    
    if (digits.length === 12 && digits.startsWith('91')) {
        digits = '0' + digits.substring(2);
    } else if (digits.length === 10) {
        digits = '0' + digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
        // already fine
    } else if (digits.length > 0) {
        throw new Error(`Invalid phone number format for Exotel: ${number}`);
    }
    
    return digits;
};

/**
 * Normalizes Indian phone numbers to E.164 format for Twilio.
 */
const normalizeTwilioNumber = (number) => {
    if (!number) return '';
    let digits = String(number).replace(/\D/g, '');
    
    if (digits.length === 10) {
        return '+91' + digits;
    } else if (digits.length === 12 && digits.startsWith('91')) {
        return '+' + digits;
    } else if (digits.length === 11 && digits.startsWith('0')) {
        return '+91' + digits.substring(1);
    }
    
    return '+' + digits;
};

module.exports = { normalizeExotelNumber, normalizeTwilioNumber };
