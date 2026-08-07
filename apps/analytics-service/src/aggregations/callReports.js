/**
 * MongoDB aggregation pipelines for call analytics
 */

/**
 * Call volume over time — grouped by day/week/month
 */
const callVolume = (tenantId, groupBy = 'day', dateQuery = {}) => {
    const dateFormat = {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        week: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
        month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
    };

    return [
        { $match: { tenantId, ...dateQuery } },
        {
            $group: {
                _id: dateFormat[groupBy] || dateFormat.day,
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
                avgDuration: { $avg: '$duration' },
            },
        },
        { $sort: { _id: 1 } },
    ];
};

/**
 * Peak calling hours
 */
const peakHours = (tenantId) => [
    { $match: { tenantId } },
    { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
];

/**
 * Disposition breakdown
 */
const dispositionBreakdown = (tenantId, dateQuery = {}) => [
    { $match: { tenantId, disposition: { $ne: null }, ...dateQuery } },
    { $group: { _id: '$disposition', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
];

module.exports = { callVolume, peakHours, dispositionBreakdown };
