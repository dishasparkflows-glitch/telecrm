const { google } = require('googleapis');
const { ApiError } = require('@sparkcrm/shared-utils');
const crypto = require('crypto');

// The credentials might be in another service, but let's assume we can fetch them via DB if they share the same mongo connection, or we can use service client. 
// For now, let's just use the IntegrationCredential model directly since we are in a monorepo and often models are accessible if registered or we can just require it.
// Actually, tenant-service owns IntegrationCredential. It's best practice to use an API call if it's microservices. 
// But let's check if meeting-service has access to it. We will use a service client to fetch it, or just do it.

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.freebusy',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
];

/**
 * Generate Authorization URL
 */
function getAuthorizationUrl(tenantId, userId) {
    // Generate state with tenantId and userId to prevent CSRF and identify user on callback
    const state = Buffer.from(JSON.stringify({ tenantId, userId, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64');
    
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Force to get refresh token
        scope: SCOPES,
        state: state
    });
}

/**
 * Handle OAuth Callback and return tokens
 */
async function getTokensFromCode(code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

/**
 * Create a configured OAuth2 client for a user
 */
function createClientWithTokens(tokens) {
    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials(tokens);
    return client;
}

/**
 * Get User's Calendars
 */
async function getCalendars(tokens) {
    const client = createClientWithTokens(tokens);
    const calendar = google.calendar({ version: 'v3', auth: client });
    
    const response = await calendar.calendarList.list();
    return response.data.items.map(c => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary || false,
        accessRole: c.accessRole
    }));
}

/**
 * Get Free/Busy info for a specific calendar
 */
async function getFreeBusy(tokens, calendarId, timeMin, timeMax, timezone) {
    const client = createClientWithTokens(tokens);
    const calendar = google.calendar({ version: 'v3', auth: client });
    
    const response = await calendar.freebusy.query({
        requestBody: {
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            timeZone: timezone,
            items: [{ id: calendarId }]
        }
    });
    
    const busySlots = response.data.calendars[calendarId]?.busy || [];
    return busySlots;
}

/**
 * Create Calendar Event with Google Meet
 */
async function createCalendarEvent(tokens, calendarId, eventDetails) {
    const client = createClientWithTokens(tokens);
    const calendar = google.calendar({ version: 'v3', auth: client });
    
    const event = {
        summary: eventDetails.summary,
        description: eventDetails.description,
        start: {
            dateTime: eventDetails.start.dateTime,
            timeZone: eventDetails.start.timeZone,
        },
        end: {
            dateTime: eventDetails.end.dateTime,
            timeZone: eventDetails.end.timeZone,
        },
        attendees: eventDetails.attendees || [],
        conferenceData: {
            createRequest: {
                requestId: eventDetails.requestId, // Unique ID for idempotency
                conferenceSolutionKey: {
                    type: 'hangoutsMeet'
                }
            }
        }
    };

    const response = await calendar.events.insert({
        calendarId: calendarId,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: event,
    });
    
    return response.data;
}

/**
 * Update Calendar Event
 */
async function updateCalendarEvent(tokens, calendarId, eventId, eventDetails) {
    const client = createClientWithTokens(tokens);
    const calendar = google.calendar({ version: 'v3', auth: client });
    
    const response = await calendar.events.patch({
        calendarId: calendarId,
        eventId: eventId,
        requestBody: eventDetails,
    });
    
    return response.data;
}

/**
 * Cancel/Delete Calendar Event
 */
async function cancelCalendarEvent(tokens, calendarId, eventId) {
    const client = createClientWithTokens(tokens);
    const calendar = google.calendar({ version: 'v3', auth: client });
    
    await calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
    });
}

module.exports = {
    getAuthorizationUrl,
    getTokensFromCode,
    getCalendars,
    getFreeBusy,
    createCalendarEvent,
    updateCalendarEvent,
    cancelCalendarEvent,
    createClientWithTokens
};
