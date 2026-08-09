const Branch = require('../models/Branch');
const { ApiResponse, ApiError, asyncHandler, computeChanges } = require('@sparkcrm/shared-utils');
const { auditLogger } = require('@sparkcrm/shared-middleware');

const createBranch = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { name, code, address, phone, email } = req.body;

    if (!name || !code) throw ApiError.badRequest('Branch name and code are required');

    const exists = await Branch.findOne({ tenantId, code: code.toUpperCase() });
    if (exists) throw ApiError.conflict('Branch code already exists');

    const branch = await Branch.create({
        tenantId, name, code: code.toUpperCase(),
        address: address || {}, phone: phone || '', email: email || '',
        'meta.createdBy': req.headers['x-user-id'],
    });

    await auditLogger.log({
        module: 'branches',
        action: 'CREATE',
        recordId: String(branch._id),
        recordType: 'Branch',
        recordName: branch.name,
        changes: [
            { field: 'name', oldValue: null, newValue: branch.name },
            { field: 'code', oldValue: null, newValue: branch.code },
        ],
        description: 'New branch created',
        req,
    });

    ApiResponse.created(res, branch, 'Branch created');
});

const getBranches = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branches = await Branch.find({ tenantId, isActive: true }).sort({ isDefault: -1, name: 1 });
    ApiResponse.success(res, branches);
});

const getBranch = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branch = await Branch.findOne({ _id: req.params.id, tenantId });
    if (!branch) throw ApiError.notFound('Branch not found');
    ApiResponse.success(res, branch);
});

const updateBranch = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { name, address, phone, email, isActive } = req.body;

    const branch = await Branch.findOne({ _id: req.params.id, tenantId });
    if (!branch) throw ApiError.notFound('Branch not found');

    const oldDoc = branch.toObject();

    if (name) branch.name = name;
    if (address) branch.address = { ...branch.address, ...address };
    if (phone !== undefined) branch.phone = phone;
    if (email !== undefined) branch.email = email;
    if (isActive !== undefined) branch.isActive = isActive;

    await branch.save();

    const changes = computeChanges(oldDoc, branch.toObject());
    await auditLogger.log({
        module: 'branches',
        action: 'UPDATE',
        recordId: String(branch._id),
        recordType: 'Branch',
        recordName: branch.name,
        changes,
        description: `${changes.length} field${changes.length === 1 ? '' : 's'} updated`,
        req,
    });

    ApiResponse.success(res, branch, 'Branch updated');
});

const deleteBranch = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branch = await Branch.findOne({ _id: req.params.id, tenantId });
    if (!branch) throw ApiError.notFound('Branch not found');
    if (branch.isDefault) throw ApiError.badRequest('Cannot delete the default branch');

    branch.isActive = false;
    await branch.save();

    await auditLogger.log({
        module: 'branches',
        action: 'DELETE',
        recordId: String(branch._id),
        recordType: 'Branch',
        recordName: branch.name,
        changes: [{ field: 'isActive', oldValue: true, newValue: false }],
        description: 'Branch deactivated',
        req,
    });

    ApiResponse.success(res, null, 'Branch deactivated');
});

module.exports = { createBranch, getBranches, getBranch, updateBranch, deleteBranch };
