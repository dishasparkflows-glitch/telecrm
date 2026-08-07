'use strict';

const mongoose = require('mongoose');
const {
    assertExactConfirmation,
    hasFlag,
    requiredEnv,
} = require('./_safety');

const INDEX_NAME = 'unique_active_meta_page_form';
const INDEX_KEYS = { provider: 1, externalPageId: 1, externalFormId: 1 };
const INDEX_OPTIONS = {
    name: INDEX_NAME,
    unique: true,
    partialFilterExpression: { provider: 'meta_lead_ads', isActive: true },
};

async function findConflicts(collection) {
    return collection.aggregate([
        {
            $match: {
                provider: 'meta_lead_ads',
                isActive: true,
            },
        },
        {
            $group: {
                _id: {
                    externalPageId: '$externalPageId',
                    externalFormId: '$externalFormId',
                },
                mappings: {
                    $push: {
                        mappingId: '$_id',
                        tenantId: '$tenantId',
                        connectionId: '$connectionId',
                    },
                },
                count: { $sum: 1 },
            },
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
    ]).toArray();
}

async function main() {
    const uri = requiredEnv('MONGO_URI_LEADS');
    await mongoose.connect(uri);

    try {
        const collection = mongoose.connection.collection('leadsourcemappings');
        const conflicts = await findConflicts(collection);
        if (conflicts.length > 0) {
            console.error(`Found ${conflicts.length} ambiguous active Meta Page/Form mapping group(s).`);
            for (const conflict of conflicts) {
                console.error('Conflicting mappings:', conflict.mappings.map((mapping) => ({
                    mappingId: String(mapping.mappingId),
                    tenantId: String(mapping.tenantId),
                    connectionId: String(mapping.connectionId),
                })));
            }
            throw new Error('Resolve conflicting ownership explicitly before creating the unique index');
        }

        if (!hasFlag('apply')) {
            console.log('No active Meta Page/Form conflicts found. Dry run complete; no index was changed.');
            return;
        }

        assertExactConfirmation('CREATE_META_MAPPING_UNIQUE_INDEX');
        if (process.env.ALLOW_OPS_MUTATIONS !== 'true') {
            throw new Error('Set ALLOW_OPS_MUTATIONS=true in the invoking process to permit index creation');
        }

        await collection.createIndex(INDEX_KEYS, INDEX_OPTIONS);
        console.log(`Created index ${INDEX_NAME}`);
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Meta mapping index migration failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    INDEX_KEYS,
    INDEX_NAME,
    INDEX_OPTIONS,
    findConflicts,
    main,
};
