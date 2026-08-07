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
            invalidatesTags: (_result, _error, { id: _id }) => [{ type: 'Meeting', id: 'LIST' }],
        }),
        addAttachment: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/meetings/${id}/attachments`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id: _id }) => [{ type: 'Meeting', id: 'LIST' }],
        }),
    }),
})

export const {
    useGetMeetingsQuery,
    useScheduleMeetingMutation,
    useUpdateMeetingMutation,
    useDeleteMeetingMutation,
    useGetBookingLinksQuery,
    useCreateBookingLinkMutation,
    useDeleteBookingLinkMutation,
    useAddCommentMutation,
    useAddAttachmentMutation,
} = meetingApi
