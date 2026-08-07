const Lead = require('../models/Lead');

/**
 * AI Lead Scoring — Calculates a 0-100 score based on 5 factors
 * Each factor contributes up to 20 points
 */
const calculateLeadScore = (lead) => {
    const breakdown = {
        profileCompleteness: 0, // 0-20: How much info we have
        engagement: 0,          // 0-20: Calls, messages, activities
        responseRate: 0,        // 0-20: How often they respond
        dealValue: 0,           // 0-20: Expected deal size
        recency: 0,             // 0-20: How recent is the last activity
    };

    // 1. Profile Completeness (0-20)
    let profilePoints = 0;
    if (lead.firstName) profilePoints += 3;
    if (lead.email) profilePoints += 4;
    if (lead.phone) profilePoints += 4;
    if (lead.company) profilePoints += 3;
    if (lead.designation) profilePoints += 2;
    if (lead.address?.city) profilePoints += 2;
    if (lead.tags?.length > 0) profilePoints += 2;
    breakdown.profileCompleteness = Math.min(20, profilePoints);

    // 2. Engagement (0-20)
    const noteCount = lead.notes?.length || 0;
    breakdown.engagement = Math.min(20, noteCount * 4);

    // 3. Response Rate (0-20) — Based on stage progression
    const stageScores = {
        new: 2,
        contacted: 6,
        qualified: 12,
        negotiation: 16,
        won: 20,
        lost: 4,
    };
    breakdown.responseRate = stageScores[lead.stage] || 2;

    // 4. Deal Value (0-20)
    if (lead.expectedValue > 0) {
        if (lead.expectedValue >= 100000) breakdown.dealValue = 20;
        else if (lead.expectedValue >= 50000) breakdown.dealValue = 15;
        else if (lead.expectedValue >= 20000) breakdown.dealValue = 10;
        else if (lead.expectedValue >= 5000) breakdown.dealValue = 5;
        else breakdown.dealValue = 2;
    }

    // 5. Recency (0-20) — Based on last activity
    if (lead.lastActivityAt) {
        const daysSinceActivity = Math.floor(
            (Date.now() - new Date(lead.lastActivityAt)) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceActivity <= 1) breakdown.recency = 20;
        else if (daysSinceActivity <= 3) breakdown.recency = 16;
        else if (daysSinceActivity <= 7) breakdown.recency = 12;
        else if (daysSinceActivity <= 14) breakdown.recency = 8;
        else if (daysSinceActivity <= 30) breakdown.recency = 4;
        else breakdown.recency = 1;
    }

    const totalScore =
        breakdown.profileCompleteness +
        breakdown.engagement +
        breakdown.responseRate +
        breakdown.dealValue +
        breakdown.recency;

    return { score: Math.min(100, totalScore), breakdown };
};

/**
 * Recalculate scores for all leads in a tenant
 * Called by cron job every 6 hours
 */
const recalculateScores = async (tenantId) => {
    const leads = await Lead.find({ tenantId, isArchived: false });
    let updated = 0;

    for (const lead of leads) {
        const { score, breakdown } = calculateLeadScore(lead);
        lead.score = score;
        lead.scoreBreakdown = breakdown;
        lead.lastScoredAt = new Date();
        await lead.save();
        updated++;
    }

    return updated;
};

module.exports = { calculateLeadScore, recalculateScores };
