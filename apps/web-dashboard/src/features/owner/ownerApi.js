import { baseApi } from '../api/baseApi'

export const ownerApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Auth
        ownerLogin: builder.mutation({
            query: (credentials) => ({
                url: '/auth/owner-login',
                method: 'POST',
                body: credentials,
            }),
        }),

        // Dashboard
        getOwnerDashboard: builder.query({
            query: () => '/owner/dashboard',
            providesTags: ['OwnerDashboard'],
        }),

        // Tenants
        getOwnerTenants: builder.query({
            query: (params) => ({
                url: '/owner/tenants',
                params,
            }),
            providesTags: ['OwnerTenants'],
        }),
        getOwnerTenantDetail: builder.query({
            query: (id) => `/owner/tenants/${id}`,
            providesTags: (result, error, id) => [{ type: 'OwnerTenants', id }],
        }),
        updateTenantPlan: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/owner/tenants/${id}/plan`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['OwnerTenants', 'OwnerDashboard'],
        }),
        updateTenantStatus: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/owner/tenants/${id}/status`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['OwnerTenants', 'OwnerDashboard'],
        }),
        updateTenantFeatures: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/owner/tenants/${id}/features`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['OwnerTenants'],
        }),
        updateTenantPaymentMethods: builder.mutation({
            query: ({ id, methods }) => ({
                url: `/owner/tenants/${id}/payment-methods`,
                method: 'PUT',
                body: { methods },
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'OwnerTenants', id }],
        }),
        updateTenantCalling: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/owner/tenants/${id}/calling`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'OwnerTenants', id }],
        }),

        // Plans
        getOwnerPlans: builder.query({
            query: () => '/owner/plans',
            providesTags: ['OwnerPlans'],
        }),
        createPlan: builder.mutation({
            query: (data) => ({
                url: '/owner/plans',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['OwnerPlans'],
        }),
        updatePlan: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/owner/plans/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['OwnerPlans'],
        }),
        deletePlan: builder.mutation({
            query: (id) => ({
                url: `/owner/plans/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['OwnerPlans'],
        }),

        // Revenue
        getOwnerRevenue: builder.query({
            query: (params) => ({
                url: '/owner/revenue',
                params,
            }),
            providesTags: ['OwnerRevenue'],
        }),

        // Impersonation
        impersonateTenant: builder.mutation({
            query: (tenantId) => ({
                url: `/owner/impersonate/${tenantId}`,
                method: 'POST',
            }),
        }),

        // Payment Methods / Configs
        getPaymentConfigs: builder.query({
            query: () => '/payments/configs',
            providesTags: ['PaymentConfigs'],
        }),
        savePaymentConfig: builder.mutation({
            query: (data) => ({
                url: '/payments/configs',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['PaymentConfigs'],
        }),
        testPaymentConfig: builder.mutation({
            query: (provider) => ({
                url: `/payments/configs/${provider}/test`,
                method: 'POST',
            }),
        }),

        // User management
        updateUserStatus: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/owner/users/${id}/status`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['OwnerTenants'],
        }),

        // Communication Configs (WhatsApp / Calling)
        getCommunicationConfigs: builder.query({
            query: () => '/owner/communication-configs',
            providesTags: ['CommConfigs'],
        }),
        updateCommunicationConfig: builder.mutation({
            query: ({ type, ...data }) => ({
                url: `/owner/communication-configs/${type}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['CommConfigs'],
        }),
        testCommunicationConfig: builder.mutation({
            query: (type) => ({
                url: `/owner/communication-configs/${type}/test`,
                method: 'POST',
            }),
        }),
    }),
})

export const {
    useOwnerLoginMutation,
    useGetOwnerDashboardQuery,
    useGetOwnerTenantsQuery,
    useGetOwnerTenantDetailQuery,
    useUpdateTenantPlanMutation,
    useUpdateTenantStatusMutation,
    useGetOwnerPlansQuery,
    useCreatePlanMutation,
    useUpdatePlanMutation,
    useDeletePlanMutation,
    useGetOwnerRevenueQuery,
    useImpersonateTenantMutation,
    useUpdateUserStatusMutation,
    useUpdateTenantFeaturesMutation,
    useUpdateTenantPaymentMethodsMutation,
    useUpdateTenantCallingMutation,
    useGetPaymentConfigsQuery,
    useSavePaymentConfigMutation,
    useTestPaymentConfigMutation,
    useGetCommunicationConfigsQuery,
    useUpdateCommunicationConfigMutation,
    useTestCommunicationConfigMutation,
} = ownerApi
