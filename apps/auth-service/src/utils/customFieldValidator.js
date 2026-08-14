const { ApiError } = require('@sparkcrm/shared-utils');
const { getCustomFieldDefinitions } = require('../services/serviceClients/tenant.client');

const validateCustomFields = async (tenantId, entity, customFieldsData) => {
    if (!customFieldsData || Object.keys(customFieldsData).length === 0) return;

    const definitions = await getCustomFieldDefinitions(tenantId, entity);
    const validFieldNames = new Set(definitions.map(d => d.name));
    
    // Check for required fields
    const requiredFields = definitions.filter(d => d.isRequired).map(d => d.name);
    for (const reqField of requiredFields) {
        if (customFieldsData[reqField] === undefined || customFieldsData[reqField] === null || customFieldsData[reqField] === '') {
            throw ApiError.badRequest(`Custom field "${reqField}" is required.`);
        }
    }

    // Check for unknown fields
    for (const key of Object.keys(customFieldsData)) {
        if (!validFieldNames.has(key)) {
            // we can either ignore or throw. Let's delete it to be safe.
            delete customFieldsData[key];
        }
    }
};

module.exports = { validateCustomFields };
