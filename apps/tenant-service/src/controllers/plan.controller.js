const Plan = require('../models/Plan');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

/**
 * GET /api/plans
 * Get all active plans (public endpoint)
 */
const getAllPlans = asyncHandler(async (req, res) => {
    const plans = await Plan.find({ isActive: true, isTrial: false })
        .sort({ sortOrder: 1 })
        .select('-__v');

    ApiResponse.success(res, plans, 'Plans fetched');
});

/**
 * GET /api/plans/:slug
 * Get a single plan by slug
 */
const getPlanBySlug = asyncHandler(async (req, res) => {
    const plan = await Plan.findOne({ slug: req.params.slug, isActive: true });
    if (!plan) throw ApiError.notFound('Plan not found');

    ApiResponse.success(res, plan, 'Plan fetched');
});

/**
 * POST /api/plans (Platform Admin only)
 * Create a new plan
 */
const createPlan = asyncHandler(async (req, res) => {
    const { name, slug, description, price, yearlyPrice, perUserPrice, features, limits, sortOrder } =
        req.body;

    const existing = await Plan.findOne({ slug });
    if (existing) throw ApiError.conflict('Plan with this slug already exists');

    const plan = await Plan.create({
        name,
        slug,
        description,
        price,
        yearlyPrice: yearlyPrice || 0,
        perUserPrice: perUserPrice || 0,
        features: features || [],
        limits: limits || {},
        sortOrder: sortOrder || 0,
    });

    ApiResponse.created(res, plan, 'Plan created');
});

/**
 * PUT /api/plans/:id (Platform Admin only)
 * Update a plan
 */
const updatePlan = asyncHandler(async (req, res) => {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!plan) throw ApiError.notFound('Plan not found');
    ApiResponse.success(res, plan, 'Plan updated');
});

module.exports = {
    getAllPlans,
    getPlanBySlug,
    createPlan,
    updatePlan,
};
