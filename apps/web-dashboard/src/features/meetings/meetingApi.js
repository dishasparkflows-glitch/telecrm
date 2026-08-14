import { baseApi } from '../api/baseApi'

export const meetingApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getMeetings: builder.query({
            query: (params) => ({
                url: '/meetings',
                params,
            }),
            providesTags: [{ type: 'Meeting', id: 'LIST' }],
        }),
        getMeeting: builder.query({
            query: (id) => `/meetings/${id}`,
            providesTags: (result, error, id) => [{ type: 'Meeting', id }],
        }),
        scheduleMeeting: builder.mutation({
            query: (data) => ({
                url: '/meetings/schedule',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Meeting', id: 'LIST' }],
        }),
        updateMeeting: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/meetings/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'Meeting', id: 'LIST' }],
        }),
        getBookingLinks: builder.query({
            query: () => '/meetings/booking-links',
            providesTags: [{ type: 'Meeting', id: 'LINKS' }],
        }),
        createBookingLink: builder.mutation({
            query: (data) => ({
                url: '/meetings/booking-links',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Meeting', id: 'LINKS' }],
        }),
        deleteMeeting: builder.mutation({
            query: (id) => ({
                url: `/meetings/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Meeting', id: 'LIST' }],
        }),
        deleteBookingLink: builder.mutation({
            query: (id) => ({
                url: `/meetings/booking-links/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Meeting', id: 'LINKS' }],
        }),
        addComment: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/meetings/${id}/comments`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id: _id }) => [{ type: 'Meeting', id: 'LIST' }, { type: 'Meeting', id: _id }],
        }),
        addAttachment: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/meetings/${id}/attachments`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id: _id }) => [{ type: 'Meeting', id: 'LIST' }, { type: 'Meeting', id: _id }],
        }),
        getPublicBookingLink: builder.query({
            query: (slug) => `/meetings/book/${slug}`,
        }),
        bookPublicMeeting: builder.mutation({
            query: ({ slug, ...data }) => ({
                url: `/meetings/book/${slug}`,
                method: 'POST',
                body: data,
            }),
        }),
        getPublicBookingAvailability: builder.query({
            query: ({ slug, date, duration }) => ({
                url: `/meetings/book/${slug}/availability`,
                params: { date, duration }
            }),
        }),
        getGoogleAuthUrl: builder.query({
            query: () => '/meetings/google/auth',
        }),
        getGoogleAuthStatus: builder.query({
            query: () => '/meetings/google/status',
            providesTags: ['GoogleAuth'],
        }),
        disconnectGoogle: builder.mutation({
            query: () => ({
                url: '/meetings/google/disconnect',
                method: 'POST',
            }),
            invalidatesTags: ['GoogleAuth'],
        }),
        getGoogleCalendars: builder.query({
            query: () => '/meetings/google/calendars',
        }),
    }),
})

export const {
    useGetMeetingsQuery,
    useGetMeetingQuery,
    useScheduleMeetingMutation,
    useUpdateMeetingMutation,
    useDeleteMeetingMutation,
    useGetBookingLinksQuery,
    useCreateBookingLinkMutation,
    useDeleteBookingLinkMutation,
    useAddCommentMutation,
    useAddAttachmentMutation,
    useGetPublicBookingLinkQuery,
    useBookPublicMeetingMutation,
    useGetPublicBookingAvailabilityQuery,
    useLazyGetGoogleAuthUrlQuery,
    useGetGoogleAuthStatusQuery,
    useDisconnectGoogleMutation,
    useGetGoogleCalendarsQuery,
} = meetingApi
