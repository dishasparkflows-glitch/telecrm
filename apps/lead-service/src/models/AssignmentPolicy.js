const mongoose = require('mongoose');
const { ASSIGNMENT_STRATEGIES } = require('@sparkcrm/shared-utils');

const assignmentPolicySchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        name: { type: String, default: 'Default assignment policy', trim: true },
        strategy: {
            type: String,
            enum: [
                ASSIGNMENT_STRATEGIES.MANUAL,
                ASSIGNMENT_STRATEGIES.ROUND_ROBIN,
                ASSIGNMENT_STRATEGIES.LOAD_BASED,
            ],
            default: ASSIGNMENT_STRATEGIES.MANUAL,
        },
        agentIds: [{ type: mongoose.Schema.Types.ObjectId }],
        cursor: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        conditions: {
            sources: [{ type: String, trim: true }],
            priorities: [{ type: String, trim: true }],
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
    { timestamps: true }
);

assignmentPolicySchema.index(
    { tenantId: 1, branchId: 1 },
    { unique: true, partialFilterExpression: { isActive: true } }
);

const AssignmentPolicy = mongoose.model('AssignmentPolicy', assignmentPolicySchema);
module.exports = AssignmentPolicy;
