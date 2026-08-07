'use strict';

const mongoose = require('mongoose');
const {
    assertExactConfirmation,
    hasFlag,
    requiredEnv,
} = require('./_safety');

const INDEXES = [
    {
        collection: 'featuretransactions',
        keys: { tenantId: 1, featureSlug: 1, isActive: 1 },
        options: {
            name: 'unique_active_tenant_feature',
            unique: true,
            partialFilterExpression: { isActive: true },
        },
    },
    {
        collection: 'featuretransactions',
        keys: { invoiceId: 1 },
        options: {
            name: 'unique_feature_entitlement_invoice',
            unique: true,
            partialFilterExpression: { invoiceId: { $type: 'objectId' } },
        },
    },
    {
        collection: 'invoices',
        keys: { tenantId: 1, type: 1, checkoutIdempotencyKey: 1 },
        options: {
            name: 'unique_tenant_checkout_idempotency',
            unique: true,
            partialFilterExpression: { checkoutIdempotencyKey: { $type: 'string' } },
        },
    },
    {
        collection: 'invoices',
        keys: { tenantId: 1, featureSlug: 1, checkoutOpen: 1 },
        options: {
            name: 'unique_open_feature_checkout',
            unique: true,
            partialFilterExpression: { type: 'feature_purchase', checkoutOpen: true },
        },
    },
];

async function findBlockers(featureTransactions, invoices) {
    const [activeConflicts, invoiceConflicts, incompleteInvoices] = await Promise.all([
        featureTransactions.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: { tenantId: '$tenantId', featureSlug: '$featureSlug' },
                    transactionIds: { $push: '$_id' },
                    count: { $sum: 1 },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ]).toArray(),
        featureTransactions.aggregate([
            { $match: { invoiceId: { $type: 'objectId' } } },
            {
                $group: {
                    _id: '$invoiceId',
                    transactionIds: { $push: '$_id' },
                    count: { $sum: 1 },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ]).toArray(),
        invoices.find({
            type: 'feature_purchase',
            $or: [
                { featureId: null },
                { featureId: { $exists: false } },
                { featureSlug: null },
                { featureSlug: '' },
                { featureSlug: { $exists: false } },
            ],
        }, {
            projection: { _id: 1, tenantId: 1, featureId: 1, featureSlug: 1, status: 1 },
        }).toArray(),
    ]);

    return { activeConflicts, invoiceConflicts, incompleteInvoices };
}

function reportBlockers(blockers) {
    for (const conflict of blockers.activeConflicts) {
        console.error('Duplicate active entitlement:', {
            tenantId: String(conflict._id.tenantId),
            featureSlug: conflict._id.featureSlug,
            transactionIds: conflict.transactionIds.map(String),
        });
    }
    for (const conflict of blockers.invoiceConflicts) {
        console.error('Invoice linked to multiple feature transactions:', {
            invoiceId: String(conflict._id),
            transactionIds: conflict.transactionIds.map(String),
        });
    }
    for (const invoice of blockers.incompleteInvoices) {
        console.error('Incomplete feature invoice:', {
            invoiceId: String(invoice._id),
            tenantId: String(invoice.tenantId),
            featureSlug: invoice.featureSlug || null,
            hasFeatureId: Boolean(invoice.featureId),
            status: invoice.status,
        });
    }
}

async function main() {
    const uri = requiredEnv('MONGO_URI_BILLING');
    await mongoose.connect(uri);

    try {
        const featureTransactions = mongoose.connection.collection('featuretransactions');
        const invoices = mongoose.connection.collection('invoices');
        const blockers = await findBlockers(featureTransactions, invoices);
        const blockerCount = Object.values(blockers).reduce((total, rows) => total + rows.length, 0);
        if (blockerCount > 0) {
            reportBlockers(blockers);
            throw new Error(`Resolve ${blockerCount} feature entitlement blocker group(s) before creating indexes`);
        }

        if (!hasFlag('apply')) {
            console.log('No feature entitlement blockers found. Dry run complete; no index was changed.');
            return;
        }

        assertExactConfirmation('CREATE_FEATURE_ENTITLEMENT_INDEXES');
        if (process.env.ALLOW_OPS_MUTATIONS !== 'true') {
            throw new Error('Set ALLOW_OPS_MUTATIONS=true in the invoking process to permit index creation');
        }

        for (const index of INDEXES) {
            await mongoose.connection.collection(index.collection)
                .createIndex(index.keys, index.options);
            console.log(`Created index ${index.options.name}`);
        }
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Feature entitlement migration failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { INDEXES, findBlockers, main };
