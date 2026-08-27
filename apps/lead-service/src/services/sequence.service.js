const crypto = require('crypto');

/**
 * Generates a formatted lead number (e.g., L-a3b4c5).
 * @returns {Promise<string>}
 */
const generateLeadNumber = async () => {
    // Replaced sequential counter with random hex as per user request to remove counters table
    const randomPart = crypto.randomBytes(3).toString('hex'); // 6 chars
    return `L-${randomPart.toUpperCase()}`;
};

module.exports = {
    generateLeadNumber
};
