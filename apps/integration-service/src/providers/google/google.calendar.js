const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./google.provider');

const getCalendarApi = async (accountId, tenantId) => {
    const auth = await getAuthenticatedClient(accountId, tenantId);
    return google.calendar({ version: 'v3', auth });
};

const getCalendars = async (accountId, tenantId) => {
    const calendar = await getCalendarApi(accountId, tenantId);
    const response = await calendar.calendarList.list();
    return response.data.items.map(c => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary || false,
        accessRole: c.accessRole
    }));
};

const getFreeBusy = async (accountId, tenantId, calendarId, timeMin, timeMax, timezone) => {
    const calendar = await getCalendarApi(accountId, tenantId);
    const response = await calendar.freebusy.query({
        requestBody: {
            timeMin: new Date(timeMin).toISOString(),
            timeMax: new Date(timeMax).toISOString(),
            timeZone: timezone,
            items: [{ id: calendarId }]
        }
    });
    
    return response.data.calendars[calendarId]?.busy || [];
};

const createCalendarEvent = async (accountId, tenantId, calendarId, eventDetails, connectionId) => {
    try {
        const calendar = await getCalendarApi(accountId, tenantId);
        
        const event = {
            summary: eventDetails.summary,
            description: eventDetails.description,
            start: {
                dateTime: new Date(eventDetails.start.dateTime).toISOString(),
                timeZone: eventDetails.start.timeZone,
            },
            end: {
                dateTime: new Date(eventDetails.end.dateTime).toISOString(),
                timeZone: eventDetails.end.timeZone,
            },
            attendees: eventDetails.attendees || [],
        };

        if (eventDetails.requestId) {
            event.conferenceData = {
                createRequest: {
                    requestId: eventDetails.requestId,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            };
        }

        const start = Date.now();
        const response = await calendar.events.insert({
            calendarId: calendarId,
            conferenceDataVersion: eventDetails.requestId ? 1 : 0,
            sendUpdates: 'all',
            requestBody: event,
        });

        return response.data;
    } catch (error) {
        throw error;
    }
};

const updateCalendarEvent = async (accountId, tenantId, calendarId, eventId, eventDetails, connectionId) => {
    try {
        const calendar = await getCalendarApi(accountId, tenantId);
        const start = Date.now();
        
        const response = await calendar.events.patch({
            calendarId: calendarId,
            eventId: eventId,
            requestBody: eventDetails,
        });

        return response.data;
    } catch (error) {
        throw error;
    }
};

const deleteCalendarEvent = async (accountId, tenantId, calendarId, eventId, connectionId) => {
    try {
        const calendar = await getCalendarApi(accountId, tenantId);
        const start = Date.now();
        
        await calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId,
        });

    } catch (error) {
        throw error;
    }
};

module.exports = {
    getCalendars,
    getFreeBusy,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
};
