/**
 * Field Diff Utility for Audit Logging
 * Compares two objects (or Mongoose documents) and returns array of changes:
 * [{ field, oldValue, newValue }]
 */

function isObject(val) {
    return val !== null && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val);
}

function formatValue(val) {
    if (val === undefined || val === null) return null;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object' && val._id) return String(val._id);
    return val;
}

function computeChanges(oldObj = {}, newObj = {}, options = {}) {
    const {
        fieldsToCompare = null,
        ignoreFields = ['_id', '__v', 'createdAt', 'updatedAt', 'meta', 'password', 'hash', 'salt'],
        prefix = '',
    } = options;

    const changes = [];
    const oldData = oldObj && typeof oldObj.toObject === 'function' ? oldObj.toObject() : (oldObj || {});
    const newData = newObj && typeof newObj.toObject === 'function' ? newObj.toObject() : (newObj || {});

    const keys = fieldsToCompare || Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));

    for (const key of keys) {
        if (ignoreFields.includes(key)) continue;

        const fieldName = prefix ? `${prefix}.${key}` : key;
        const oldVal = oldData[key];
        const newVal = newData[key];

        // Skip if both undefined or null
        if ((oldVal === undefined || oldVal === null) && (newVal === undefined || newVal === null)) {
            continue;
        }

        // Handle nested plain objects recursively
        if (isObject(oldVal) && isObject(newVal)) {
            const nestedChanges = computeChanges(oldVal, newVal, {
                ...options,
                prefix: fieldName,
                fieldsToCompare: null
            });
            changes.push(...nestedChanges);
            continue;
        }

        const strOld = JSON.stringify(formatValue(oldVal));
        const strNew = JSON.stringify(formatValue(newVal));

        if (strOld !== strNew) {
            changes.push({
                field: fieldName,
                oldValue: formatValue(oldVal),
                newValue: formatValue(newVal),
            });
        }
    }

    return changes;
}

module.exports = { computeChanges, formatValue };
