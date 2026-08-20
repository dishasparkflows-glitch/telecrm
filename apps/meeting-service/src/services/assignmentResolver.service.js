const { ApiError } = require('@sparkcrm/shared-utils');
const { Meeting } = require('../models/Meeting');
const googleCalendarService = require('./googleCalendar.service');
const { getUserIntegrationConfig } = require('./serviceClients/tenant.client');

const resolveBookingHost = async (bookingLink, lead, scheduledAt, requestedEnd, tenantId) => {
    let resolvedHostId = null;

    if (bookingLink.assignmentType === 'specific_user') {
        resolvedHostId = bookingLink.assignedUserId || bookingLink.userId;
    } else if (bookingLink.assignmentType === 'lead_owner') {
        resolvedHostId = lead?.assignedTo || bookingLink.fallbackUserId || bookingLink.userId;
    } else if (bookingLink.assignmentType === 'round_robin') {
        const candidates = bookingLink.assignedUserIds || [];
        if (candidates.length === 0) {
            resolvedHostId = bookingLink.userId;
        } else {
            // Find candidate with fewest meetings in this time window
            let bestCandidate = null;

            for (const candidateId of candidates) {
                // 1. Check internal meetings
                const internalMeetingsCount = await Meeting.countDocuments({
                    tenantId,
                    hostId: candidateId,
                    'meeting.status': { $in: ['scheduled', 'confirmed'] },
                    $or: [
                        { 'meeting.scheduledAt': { $lt: requestedEnd }, 'meeting.endTime': { $gt: scheduledAt } }
                    ]
                });

                if (internalMeetingsCount > 0) continue; // Busy internally

                // 2. Check Google FreeBusy if google meet is provider
                let isGoogleBusy = false;
                if (bookingLink.provider === 'google_meet') {
                    // We need a helper to get tokens. Let's assume a getTokensHelper exists or we fetch from DB here.
                    // For now, we rely on the main controller to do final validation. 
                    // To do it right, we should check FreeBusy here.
                    const cred = await getUserIntegrationConfig(tenantId, candidateId, 'google_calendar');
                    if (cred && cred.credentials) {
                        const tokens = cred.credentials;
                        if (tokens.refresh_token) {
                            try {
                                const busySlots = await googleCalendarService.getFreeBusy(tokens, tokens.calendarId, scheduledAt, requestedEnd, bookingLink.availability.timezone);
                                if (busySlots.length > 0) {
                                    isGoogleBusy = true;
                                }
                            } catch (e) {
                                console.warn('Freebusy check failed for candidate', candidateId, e.message);
                            }
                        }
                    }
                }

                if (isGoogleBusy) continue;

                // Pick the one with fewest total meetings today, or just pick first available
                // For simplicity in this iteration, pick first available
                bestCandidate = candidateId;
                break;
            }

            if (!bestCandidate) {
                throw ApiError.conflict('No team members are available for this time slot');
            }
            resolvedHostId = bestCandidate;
        }
    } else {
        // Fallback
        resolvedHostId = bookingLink.userId;
    }

    if (!resolvedHostId) {
        throw ApiError.internal('Unable to resolve a host for this meeting');
    }

    return resolvedHostId;
};

module.exports = {
    resolveBookingHost,
};
