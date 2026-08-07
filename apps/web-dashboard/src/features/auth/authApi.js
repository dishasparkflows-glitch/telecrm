import { baseApi } from '../api/baseApi'
import { setCredentials } from '../../slices/authSlice'

export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        sendOtp: builder.mutation({
            query: (data) => ({
                url: '/auth/send-otp',
                method: 'POST',
                body: data,
            }),
        }),
        verifyOtp: builder.mutation({
            query: (data) => ({
                url: '/auth/verify-otp',
                method: 'POST',
                body: data,
            }),
        }),
        login: builder.mutation({
            query: (credentials) => ({
                url: '/auth/login',
                method: 'POST',
                body: credentials,
            }),
        }),
        registerTenant: builder.mutation({
            query: (data) => ({
                url: '/auth/register-tenant',
                method: 'POST',
                body: data,
            }),
        }),
        getMe: builder.query({
            query: () => '/auth/me',
            providesTags: ['User'],
            async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
                try {
                    const { data: result } = await queryFulfilled
                    const token = getState().auth.token
                    if (result?.data && token) {
                        dispatch(setCredentials({
                            user: result.data.user || result.data,
                            token,
                            permissions: result.data.permissions,
                            modules: result.data.modules,
                            branches: result.data.branches,
                            features: result.data.features,
                            plan: result.data.plan,
                            subscription: result.data.subscription,
                        }))
                    }
                } catch { /* The existing session remains unchanged when profile hydration fails. */ }
            },
        }),
        refreshToken: builder.mutation({
            query: () => ({
                url: '/auth/refresh-token',
                method: 'POST',
            }),
        }),
        forgotPassword: builder.mutation({
            query: (data) => ({
                url: '/auth/forgot-password',
                method: 'POST',
                body: data,
            }),
        }),
        resetPassword: builder.mutation({
            query: (data) => ({
                url: '/auth/reset-password',
                method: 'POST',
                body: data,
            }),
        }),
        logout: builder.mutation({
            query: () => ({
                url: '/auth/logout',
                method: 'POST',
            }),
        }),
        switchBranch: builder.mutation({
            query: (branchId) => ({
                url: '/auth/active-branch',
                method: 'PUT',
                body: { branchId },
            }),
        }),
        getUsers: builder.query({
            query: (params) => ({
                url: '/users',
                params,
            }),
            providesTags: ['User'],
        }),
    }),
})

export const {
    useSendOtpMutation,
    useVerifyOtpMutation,
    useLoginMutation,
    useRegisterTenantMutation,
    useGetMeQuery,
    useRefreshTokenMutation,
    useForgotPasswordMutation,
    useResetPasswordMutation,
    useLogoutMutation,
    useSwitchBranchMutation,
    useGetUsersQuery,
} = authApi
