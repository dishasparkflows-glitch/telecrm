import { baseApi } from '../api/baseApi'

export const callApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getCallLogs: builder.query({
            query: (params) => ({
                url: '/calls/logs',
                params,
            }),
            providesTags: [{ type: 'Call', id: 'LIST' }],
        }),
        getCallRecording: builder.query({
            query: (id) => `/calls/${id}/recording`,
        }),
        getCallStats: builder.query({
            query: () => '/calls/stats',
            providesTags: [{ type: 'Call', id: 'STATS' }],
        }),
        initiateCall: builder.mutation({
            query: (data) => ({
                url: '/calls/initiate',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Call', id: 'LIST' }, { type: 'Call', id: 'STATS' }],
        }),
        updateDisposition: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/calls/${id}/disposition`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'Call', id: 'LIST' }],
        }),
    }),
})

export const {
    useGetCallLogsQuery,
    useLazyGetCallRecordingQuery,
    useGetCallStatsQuery,
    useInitiateCallMutation,
    useUpdateDispositionMutation,
} = callApi
