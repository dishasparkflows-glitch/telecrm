const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const CustomFieldDefinition = require('../models/CustomFieldDefinition');
const Branch = require('../models/Branch');
const { IntegrationCredential, decrypt } = require('../models/IntegrationCredential');

const BUILT_IN_ROLE_KEYS = [
    'super-admin', 'branch-manager', 'sales-lead',
    'senior-agent', 'junior-agent', 'support-agent',
];

async function migrateIntegrationRoutingIds() {
    const credentials = await IntegrationCredential.find({
        provider: 'whatsapp',
        phoneNumberId: null,
    });
    for (const credential of credentials) {
        const stored = credential.credentials?.get('phone_number_id');
        if (!stored) continue;
        try {
            credential.phoneNumberId = stored.includes(':') ? decrypt(stored) : stored;
            credential.credentials.delete('phone_number_id');
            await credential.save();
        } catch (err) {
            console.warn(`Could not migrate WhatsApp routing metadata for integration ${credential._id}: ${err.message}`);
        }
    }
}

async function migrateRoleSystemKeys() {
    for (const systemKey of BUILT_IN_ROLE_KEYS) {
        await Role.updateMany(
            { slug: systemKey, systemKey: null },
            { $set: { systemKey } }
        );
    }
}

async function migrateEmbeddedCustomFields() {
    const cursor = Tenant.find({ 'customFields.0': { $exists: true } })
        .select('_id customFields')
        .lean()
        .cursor();
    for await (const tenant of cursor) {
        const uniqueFields = new Map();
        tenant.customFields.forEach((field, index) => {
            const name = String(field.name || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            if (name && !uniqueFields.has(name)) uniqueFields.set(name, { field, index });
        });
        const operations = [...uniqueFields.entries()].map(([name, { field, index }]) => ({
            updateOne: {
                filter: { tenantId: tenant._id, entity: 'Lead', name, isActive: true },
                update: {
                    $setOnInsert: {
                        tenantId: tenant._id,
                        entity: 'Lead',
                        label: field.name,
                        name,
                        type: field.type,
                        options: field.options || [],
                        isRequired: Boolean(field.required),
                        order: field.order ?? index,
                        isActive: true,
                    },
                },
                upsert: true,
            },
        }));
        if (operations.length > 0) await CustomFieldDefinition.bulkWrite(operations, { ordered: false });
    }
}

async function repairDefaultInvariants() {
    const tenantIds = await Tenant.distinct('_id');
    for (const tenantId of tenantIds) {
        const branches = await Branch.find({ tenantId }).sort({ isDefault: -1, createdAt: 1 });
        if (branches.length > 0) {
            const keepBranch = branches.find((branch) => branch.isDefault && branch.isActive)
                || branches.find((branch) => branch.isActive)
                || branches[0];
            await Branch.updateMany({ tenantId, _id: { $ne: keepBranch._id } }, { $set: { isDefault: false } });
            await Branch.updateOne({ _id: keepBranch._id }, { $set: { isDefault: true, isActive: true } });
        }

        const roles = await Role.find({ tenantId, isActive: true }).sort({ isDefault: -1, createdAt: 1 });
        if (roles.length > 0) {
            const keepRole = roles.find((role) => role.isDefault)
                || roles.find((role) => (role.systemKey || role.slug) === 'junior-agent')
                || roles[0];
            await Role.updateMany({ tenantId, _id: { $ne: keepRole._id } }, { $set: { isDefault: false } });
            await Role.updateOne({ _id: keepRole._id }, { $set: { isDefault: true } });
        }
    }
}

async function assertUniqueTenantEmails() {
    const duplicates = await Tenant.aggregate([
        { $group: { _id: '$email', count: { $sum: 1 } } },
        { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
        { $limit: 1 },
    ]);
    if (duplicates.length > 0) {
        throw new Error('Duplicate tenant emails must be resolved before tenant-service can enforce unique ownership');
    }
}

async function migrateCustomFieldIndex() {
    const indexes = await CustomFieldDefinition.collection.indexes();
    const legacy = indexes.find((index) => index.name === 'tenantId_1_entity_1_name_1' && !index.partialFilterExpression);
    if (legacy) await CustomFieldDefinition.collection.dropIndex(legacy.name);
    await CustomFieldDefinition.syncIndexes();
}

async function runMigrations() {
    await assertUniqueTenantEmails();
    await repairDefaultInvariants();
    await migrateIntegrationRoutingIds();
    await migrateRoleSystemKeys();
    await migrateEmbeddedCustomFields();
    await migrateCustomFieldIndex();
}

module.exports = { runMigrations };
