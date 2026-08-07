import { baseApi } from '../api/baseApi'

export const analyticsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getDashboard: builder.query({
            query: (params) => ({
                url: '/analytics/dashboard',
                params,
            }),
            providesTags: [{ type: 'Analytics', id: 'DASHBOARD' }],
        }),
        getLeadAnalytics: builder.query({
            query: (params) => ({
                url: '/analytics/leads',
                params,
            }),
            providesTags: [{ type: 'Analytics', id: 'LEADS' }],
        }),
        getCallAnalytics: builder.query({
            query: (params) => ({
                url: '/analytics/calls',
                params,
            }),
            providesTags: [{ type: 'Analytics', id: 'CALLS' }],
        }),
        getTeamAnalytics: builder.query({
            query: (params) => ({
                url: '/analytics/team',
                params,
            }),
            providesTags: [{ type: 'Analytics', id: 'TEAM' }],
        }),
        getRevenueAnalytics: builder.query({
            query: (params) => ({
                url: '/analytics/revenue',
                params,
            }),
            providesTags: [{ type: 'Analytics', id: 'REVENUE' }],
        }),
    }),
})

export const {
    useGetDashboardQuery,
    useGetLeadAnalyticsQuery,
    useGetCallAnalyticsQuery,
    useGetTeamAnalyticsQuery,
    useGetRevenueAnalyticsQuery,
} = analyticsApi
