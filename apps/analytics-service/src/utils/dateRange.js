const resolveDateRange = ({ range, from, to } = {}) => {
    const end = to ? new Date(to) : new Date();
    if (from) return { $gte: new Date(from), $lte: end };
    const durations = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = durations[range];
    if (!days) return null;
    return { $gte: new Date(end.getTime() - days * 24 * 60 * 60 * 1000), $lte: end };
};

module.exports = { resolveDateRange };
