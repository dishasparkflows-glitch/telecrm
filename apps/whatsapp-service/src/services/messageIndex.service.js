const { WhatsappMessage } = require('../models/WhatsappModels');

async function ensureMessageIndexes() {
    // Older schema versions wrote idempotencyKey: null. MongoDB's sparse unique
    // index still indexes explicit null, so every subsequent chat insert failed.
    await WhatsappMessage.updateMany(
        { idempotencyKey: null },
        { $unset: { idempotencyKey: 1 } }
    );

    const indexes = await WhatsappMessage.collection.indexes();
    const existing = indexes.find((index) => index.name === 'idempotencyKey_1');
    const hasCorrectPartialIndex = existing?.unique === true
        && existing.partialFilterExpression?.idempotencyKey?.$type === 'string';

    if (existing && !hasCorrectPartialIndex) {
        await WhatsappMessage.collection.dropIndex('idempotencyKey_1');
    }
    if (!hasCorrectPartialIndex) {
        await WhatsappMessage.collection.createIndex(
            { idempotencyKey: 1 },
            {
                name: 'idempotencyKey_1',
                unique: true,
                partialFilterExpression: { idempotencyKey: { $type: 'string' } },
            }
        );
    }
}

module.exports = { ensureMessageIndexes };
