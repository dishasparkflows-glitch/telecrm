/**
 * MongoDB aggregation pipelines for lead analytics
 */

/**
 * Lead conversion funnel — counts by stage for a tenant
 */
const conversionFunnel = (tenantId, dateQuery = {}) => [
    { $match: { tenantId, isArchived: false, ...dateQuery } },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
];

/**
 * Leads by source — breakdown of where leads come from
 */
const leadsBySource = (tenantId, dateQuery = {}) => [
    { $match: { tenantId, isArchived: false, ...dateQuery } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
];

/**
 * Lead creation trends — grouped by day/week/month
 */
const leadTrends = (tenantId, groupBy = 'day', dateQuery = {}) => {
    const dateFormat = {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        week: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
        month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
    };

    return [
        { $match: { tenantId, isArchived: false, ...dateQuery } },
        { $group: { _id: dateFormat[groupBy] || dateFormat.day, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ];
};

/**
 * Lead score distribution (hot/warm/cold)
 */
const scoreDistribution = (tenantId) => [
    { $match: { tenantId, isArchived: false } },
    {
        $bucket: {
            groupBy: '$score',
            boundaries: [0, 50, 80, 101],
            default: 'unscored',
            output: { count: { $sum: 1 } },
        },
    },
];

module.exports = { conversionFunnel, leadsBySource, leadTrends, scoreDistribution };
