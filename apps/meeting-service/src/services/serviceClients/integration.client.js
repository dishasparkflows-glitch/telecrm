const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { ApiError } = require('@sparkcrm/shared-utils');

const INTEGRATION_SERVICE = env.SERVICES.INTEGRATION || 'http://localhost:8013';

const apiClient = axios.create({
    baseURL: `${INTEGRATION_SERVICE}/internal`,
    headers: {
        'x-internal-service-secret': env.INTERNAL_SERVICE_SECRET
    }
});

const getConnection = async (tenantId, ownerId, provider, integrationType) => {
    try {
        const response = await apiClient.post('/connections/resolve', {
            tenantId,
            ownerId,
            provider,
            integrationType
        });
        return response.data.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // No connection found
        }
        throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to resolve connection');
    }
};

const getGoogleCalendarConnection = (tenantId, userId) => getConnection(tenantId, userId, 'GOOGLE', 'GOOGLE_CALENDAR');

const googleCalendarApi = {
    getCalendars: async (tenantId, connectionId) => {
        const res = await apiClient.get(`/google/calendar/list/${connectionId}`, { params: { tenantId } });
        return res.data.data;
    },
    getFreeBusy: async (tenantId, connectionId, calendarId, timeMin, timeMax, timezone) => {
        const res = await apiClient.post(`/google/calendar/freebusy`, {
            tenantId,
            connectionId,
            calendarId,
            timeMin,
            timeMax,
            timezone
        });
        return res.data.data;
    },
    createEvent: async (tenantId, connectionId, calendarId, eventDetails) => {
        const res = await apiClient.post(`/google/calendar/events`, {
            tenantId,
            connectionId,
            calendarId,
            ...eventDetails
        });
        return res.data.data;
    },
    updateEvent: async (tenantId, connectionId, calendarId, eventId, eventDetails) => {
        const res = await apiClient.patch(`/google/calendar/events/${eventId}`, {
            tenantId,
            connectionId,
            calendarId,
            ...eventDetails
        });
        return res.data.data;
    },
    deleteEvent: async (tenantId, connectionId, calendarId, eventId) => {
        const res = await apiClient.delete(`/google/calendar/events/${eventId}`, {
            data: { tenantId, connectionId, calendarId }
        });
        return res.data.data;
    }
};

module.exports = {
    apiClient,
    getConnection,
    getGoogleCalendarConnection,
    googleCalendarApi,
};
