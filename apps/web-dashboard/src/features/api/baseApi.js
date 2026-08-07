import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const baseQuery = fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
        const token = getState().auth.token
        if (token) headers.set('Authorization', `Bearer ${token}`)

        // Always send branch context so backend knows the user's branch
        const { activeBranchId } = getState().auth
        if (activeBranchId) {
            headers.set('x-branch-id', activeBranchId)
        }

        return headers
    },
})

const baseQueryWithInterceptor = async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions)

    // Intercept 403 Feature Not Available errors
    // When a tenant's feature is removed or plan changes, any action restricted by featureGuard
    // will return 403. We instantly dispatch a refetch of User and Modules to sync the UI in real-time.
    if (result.error && result.error.status === 403 && result.error.data?.code === 'FEATURE_NOT_AVAILABLE') {
        // Delay slightly to ensure backend transactions are committed
        setTimeout(() => api.dispatch(baseApi.util.invalidateTags(['User', 'Modules'])), 100)
    }

    return result
}

export const baseApi = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithInterceptor,
    tagTypes: [
        'Lead', 'Call', 'Form', 'Meeting', 'Automation',
        'User', 'Users', 'Notification', 'Analytics', 'Tenant',
        'Billing', 'Feature', 'Audit', 'WhatsApp',
        'Roles', 'Modules', 'Branches', 'Integration', 'CustomField',
        'OwnerDashboard', 'OwnerTenants', 'OwnerPlans', 'OwnerRevenue',
        'PaymentConfigs', 'CommConfigs',
    ],
    endpoints: () => ({}),
})
