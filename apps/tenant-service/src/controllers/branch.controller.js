const Branch = require('../models/Branch');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

const createBranch = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { name, code, address, phone, email } = req.body;

    if (!name || !code) throw ApiError.badRequest('Branch name and code are required');

    const exists = await Branch.findOne({ tenantId, code: code.toUpperCase() });
    if (exists) throw ApiError.conflict('Branch code already exists');

    const branch = await Branch.create({
        tenantId, name, code: code.toUpperCase(),
        address: address || {}, phone: phone || '', email: email || '',
        createdBy: req.headers['x-user-id'],
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

    if (name) branch.name = name;
    if (address) branch.address = { ...branch.address, ...address };
    if (phone !== undefined) branch.phone = phone;
    if (email !== undefined) branch.email = email;
    if (isActive !== undefined) branch.isActive = isActive;

    await branch.save();
    ApiResponse.success(res, branch, 'Branch updated');
});

const deleteBranch = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branch = await Branch.findOne({ _id: req.params.id, tenantId });
    if (!branch) throw ApiError.notFound('Branch not found');
    if (branch.isDefault) throw ApiError.badRequest('Cannot delete the default branch');

    branch.isActive = false;
    await branch.save();
    ApiResponse.success(res, null, 'Branch deactivated');
});

module.exports = { createBranch, getBranches, getBranch, updateBranch, deleteBranch };
