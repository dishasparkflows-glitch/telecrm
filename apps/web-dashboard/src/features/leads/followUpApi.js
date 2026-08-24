import { baseApi } from '../api/baseApi'

export const followUpApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getFollowUps: builder.query({
            query: (params) => ({
                url: '/follow-ups',
                params,
            }),
            providesTags: (result) =>
                result?.data
                    ? [...result.data.map(({ _id }) => ({ type: 'FollowUp', id: _id })), { type: 'FollowUp', id: 'LIST' }]
                    : [{ type: 'FollowUp', id: 'LIST' }],
        }),
        getCalendarFollowUps: builder.query({
            query: (params) => ({
                url: '/follow-ups/calendar',
                params,
            }),
            providesTags: [{ type: 'FollowUp', id: 'LIST' }],
        }),
        getFollowUpStats: builder.query({
            query: () => '/follow-ups/stats',
            providesTags: [{ type: 'FollowUp', id: 'STATS' }],
        }),
        scheduleFollowUp: builder.mutation({
            query: (data) => ({
                url: '/follow-ups',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'FollowUp', id: 'LIST' }, { type: 'FollowUp', id: 'STATS' }, { type: 'Lead' }],
        }),
        completeFollowUp: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/follow-ups/${id}/complete`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'FollowUp', id },
                { type: 'FollowUp', id: 'LIST' },
                { type: 'FollowUp', id: 'STATS' },
                { type: 'Lead' }
            ],
        }),
        rescheduleFollowUp: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/follow-ups/${id}/reschedule`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'FollowUp', id },
                { type: 'FollowUp', id: 'LIST' },
                { type: 'FollowUp', id: 'STATS' },
                { type: 'Lead' }
            ],
        }),
        cancelFollowUp: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/follow-ups/${id}/cancel`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'FollowUp', id },
                { type: 'FollowUp', id: 'LIST' },
                { type: 'FollowUp', id: 'STATS' },
                { type: 'Lead' }
            ],
        }),
    }),
})

export const {
    useGetFollowUpsQuery,
    useGetCalendarFollowUpsQuery,
    useGetFollowUpStatsQuery,
    useScheduleFollowUpMutation,
    useCompleteFollowUpMutation,
    useRescheduleFollowUpMutation,
    useCancelFollowUpMutation,
} = followUpApi
