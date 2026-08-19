const mongoose = require('mongoose');

/**
 * Atomically generates and increments a sequence for a given entity.
 * @param {string} sequenceName - The unique name for the sequence (e.g., 'lead')
 * @returns {Promise<number>} - The new incremented sequence number
 */
const generateSequence = async (sequenceName) => {
    const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
        { _id: sequenceName },
        { $inc: { sequence: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    return counter?.value?.sequence || counter?.sequence || 1;
};

/**
 * Generates a formatted lead number (e.g., L-000001).
 * @returns {Promise<string>}
 */
const generateLeadNumber = async () => {
    const seq = await generateSequence('lead');
    return `L-${String(seq).padStart(6, '0')}`;
};

module.exports = {
    generateSequence,
    generateLeadNumber
};
