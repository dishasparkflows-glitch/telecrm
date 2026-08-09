/**
 * MongoDB aggregation pipelines for agent/team performance
 */

/**
 * Leads per agent
 */
const leadsPerAgent = (tenantId, dateQuery = {}) => [
    { $match: { tenantId, assignedTo: { $ne: null }, isArchived: false, ...dateQuery } },
    {
        $group: {
            _id: '$assignedTo',
            totalLeads: { $sum: 1 },
            wonLeads: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$pipeline.stage', '$stage'] }, 'won'] }, 1, 0] } },
            lostLeads: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$pipeline.stage', '$stage'] }, 'lost'] }, 1, 0] } },
            avgScore: { $avg: '$score' },
        },
    },
    { $sort: { totalLeads: -1 } },
];

/**
 * Calls per agent
 */
const callsPerAgent = (tenantId, dateQuery = {}) => [
    { $match: { tenantId, callerId: { $ne: null }, ...dateQuery } },
    {
        $group: {
            _id: '$callerId',
            totalCalls: { $sum: 1 },
            completedCalls: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            totalDuration: { $sum: '$duration' },
            avgDuration: { $avg: '$duration' },
        },
    },
    { $sort: { totalCalls: -1 } },
];

module.exports = { leadsPerAgent, callsPerAgent };
