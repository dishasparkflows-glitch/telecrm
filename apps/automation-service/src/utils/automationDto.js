const mongoose = require('mongoose');
const { ApiError } = require('@sparkcrm/shared-utils');

const RULE_WRITE_FIELDS = Object.freeze(['name', 'description', 'trigger', 'nodes', 'edges', 'type', 'status']);
const TRIGGER_FIELDS = Object.freeze(['event', 'conditions', 'schedule', 'audience']);
const CONDITION_FIELDS = Object.freeze(['_id', 'field', 'operator', 'value']);
const NODE_FIELDS = Object.freeze(['_id', 'id', 'type', 'actionType', 'config', 'delay', 'conditions']);
const EDGE_FIELDS = Object.freeze(['_id', 'id', 'source', 'target', 'sourceHandle']);

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function pickStrictObject(value, allowedFields, label) {
    if (!isPlainObject(value)) throw ApiError.badRequest(`${label} must be an object`);
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field)).sort();
    if (unknown.length) throw ApiError.badRequest(`Unsupported ${label} fields: ${unknown.join(', ')}`);
    return Object.fromEntries(
        allowedFields.filter((field) => value[field] !== undefined).map((field) => [field, value[field]])
    );
}

function sanitizeArray(value, allowedFields, label) {
    if (!Array.isArray(value)) throw ApiError.badRequest(`${label} must be an array`);
    return value.map((entry, index) => pickStrictObject(entry, allowedFields, `${label}[${index}]`));
}

function pickRuleWriteInput(input) {
    const rule = pickStrictObject(input, RULE_WRITE_FIELDS, 'automation rule');
    if (rule.trigger !== undefined) {
        rule.trigger = pickStrictObject(rule.trigger, TRIGGER_FIELDS, 'trigger');
        if (rule.trigger.conditions !== undefined) {
            rule.trigger.conditions = sanitizeArray(rule.trigger.conditions, CONDITION_FIELDS, 'conditions');
        }
    }
    if (rule.nodes !== undefined) {
        rule.nodes = sanitizeArray(rule.nodes, NODE_FIELDS, 'nodes');
        for (const [index, node] of rule.nodes.entries()) {
            if (node.config !== undefined && !isPlainObject(node.config)) {
                throw ApiError.badRequest(`nodes[${index}].config must be an object`);
            }
            if (node.conditions !== undefined) {
                node.conditions = sanitizeArray(node.conditions, CONDITION_FIELDS, `nodes[${index}].conditions`);
            }
        }
    }
    if (rule.edges !== undefined) {
        rule.edges = sanitizeArray(rule.edges, EDGE_FIELDS, 'edges');
    }
    return rule;
}

function requireObjectId(value, name) {
    if (!mongoose.Types.ObjectId.isValid(String(value || ''))) {
        throw ApiError.badRequest(`${name} must be a valid ObjectId`);
    }
    return String(value);
}

function pagination(query, defaultLimit = 25, maxLimit = 100) {
    const page = Number.parseInt(query.page === undefined ? '1' : query.page, 10);
    const limit = Number.parseInt(query.limit === undefined ? String(defaultLimit) : query.limit, 10);
    if (!Number.isInteger(page) || page < 1) throw ApiError.badRequest('page must be a positive integer');
    if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
        throw ApiError.badRequest(`limit must be between 1 and ${maxLimit}`);
    }
    return { page, limit, skip: (page - 1) * limit };
}

module.exports = { pickRuleWriteInput, requireObjectId, pagination };
