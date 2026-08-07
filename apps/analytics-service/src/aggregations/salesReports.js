/**
 * MongoDB aggregation pipelines for sales/revenue analytics
 */

/**
 * Revenue by month from invoices
 */
const revenueByMonth = (tenantId, dateQuery = {}) => [
    { $match: { tenantId, status: 'paid', ...dateQuery } },
    {
        $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
        },
    },
    { $sort: { _id: 1 } },
];

/**
 * Deal pipeline value (leads in won stage)
 */
const pipelineValue = (tenantId) => [
    { $match: { tenantId, isArchived: false } },
    {
        $group: {
            _id: '$stage',
            totalValue: { $sum: '$dealValue' },
            count: { $sum: 1 },
        },
    },
    { $sort: { totalValue: -1 } },
];

module.exports = { revenueByMonth, pipelineValue };
