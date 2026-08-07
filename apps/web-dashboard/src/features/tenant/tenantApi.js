import { baseApi } from '../api/baseApi'

export const tenantApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Tenant profile & settings
        getProfile: builder.query({
            query: () => '/tenants/profile',
            providesTags: [{ type: 'Tenant', id: 'PROFILE' }],
        }),
        updateSettings: builder.mutation({
            query: (data) => ({
                url: '/tenants/settings',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'Tenant', id: 'PROFILE' }],
        }),
        getTrialStatus: builder.query({
            query: () => '/tenants/trial-status',
            providesTags: [{ type: 'Tenant', id: 'TRIAL' }],
        }),
        getBillingDetails: builder.query({
            query: () => '/tenants/billing',
            providesTags: [{ type: 'Tenant', id: 'BILLING' }],
        }),
        getPaymentHistory: builder.query({
            query: (params) => ({
                url: '/tenants/payment-history',
                params,
            }),
            providesTags: [{ type: 'Tenant', id: 'PAYMENTS' }],
        }),
        upgradePlan: builder.mutation({
            query: (data) => ({
                url: '/tenants/upgrade-plan',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Tenant', 'Billing', 'Feature'],
        }),
        updatePipeline: builder.mutation({
            query: (data) => ({
                url: '/tenants/pipeline',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'Tenant', id: 'PROFILE' }],
        }),
        addCustomField: builder.mutation({
            query: (data) => ({
                url: '/tenants/custom-fields',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Tenant', id: 'PROFILE' }],
        }),
        updateOnboarding: builder.mutation({
            query: (data) => ({
                url: '/tenants/onboarding',
                method: 'PUT',
                body: data,
            }),
        }),
        // Plans (public)
        getAllPlans: builder.query({
            query: () => '/plans',
        }),
        getPlanBySlug: builder.query({
            query: (slug) => `/plans/${slug}`,
        }),
        // Referral
        getReferralCode: builder.query({
            query: () => '/referral/code',
        }),
        getReferralStats: builder.query({
            query: () => '/referral/stats',
        }),
        // Audit
        getAuditLogs: builder.query({
            query: (params) => ({
                url: '/audit',
                params,
            }),
            providesTags: [{ type: 'Audit', id: 'LIST' }],
        }),
    }),
})

export const {
    useGetProfileQuery,
    useUpdateSettingsMutation,
    useGetTrialStatusQuery,
    useGetBillingDetailsQuery,
    useGetPaymentHistoryQuery,
    useUpgradePlanMutation,
    useUpdatePipelineMutation,
    useAddCustomFieldMutation,
    useUpdateOnboardingMutation,
    useGetAllPlansQuery,
    useGetPlanBySlugQuery,
    useGetReferralCodeQuery,
    useGetReferralStatsQuery,
    useGetAuditLogsQuery,
} = tenantApi
