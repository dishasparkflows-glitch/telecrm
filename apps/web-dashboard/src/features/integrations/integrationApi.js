import { baseApi } from '../api/baseApi'

export const integrationApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Get provider field definitions
        getProviders: builder.query({
            query: () => '/integrations/providers',
            providesTags: ['Integration'],
        }),

        // Get all configured integrations (masked credentials)
        getIntegrations: builder.query({
            query: () => '/integrations',
            providesTags: ['Integration'],
        }),

        // Get a single integration (decrypted)
        getIntegration: builder.query({
            query: (provider) => `/integrations/${provider}`,
            providesTags: (result, error, provider) => [{ type: 'Integration', id: provider }],
        }),

        // Save (create or update) integration credentials
        saveIntegration: builder.mutation({
            query: (body) => ({
                url: '/integrations',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Integration'],
        }),

        // Delete an integration
        deleteIntegration: builder.mutation({
            query: (provider) => ({
                url: `/integrations/${provider}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Integration'],
        }),

        // Test integration connectivity
        testIntegration: builder.mutation({
            query: (provider) => ({
                url: `/integrations/${provider}/test`,
                method: 'POST',
            }),
            invalidatesTags: ['Integration'],
        }),
    }),
})

export const {
    useGetProvidersQuery,
    useGetIntegrationsQuery,
    useGetIntegrationQuery,
    useSaveIntegrationMutation,
    useDeleteIntegrationMutation,
    useTestIntegrationMutation,
} = integrationApi
