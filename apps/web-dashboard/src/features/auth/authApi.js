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
        login2FA: builder.mutation({
            query: (data) => ({
                url: '/auth/login-2fa',
                method: 'POST',
                body: data,
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
        updatePassword: builder.mutation({
            query: (data) => ({
                url: '/auth/update-password',
                method: 'PUT',
                body: data,
            }),
        }),
        generate2FA: builder.mutation({
            query: () => ({
                url: '/auth/2fa/generate',
                method: 'POST',
            }),
        }),
        verify2FA: builder.mutation({
            query: (data) => ({
                url: '/auth/2fa/verify',
                method: 'POST',
                body: data,
            }),
        }),
        disable2FA: builder.mutation({
            query: (data) => ({
                url: '/auth/2fa/disable',
                method: 'POST',
                body: data,
            }),
        }),
        getUsers: builder.query({
            query: (params) => ({
                url: '/users',
                params,
            }),
            providesTags: ['User'],
        }),
        getTrustedDevices: builder.query({
            query: () => '/auth/trusted-devices',
            providesTags: ['TrustedDevices'],
        }),
        revokeTrustedDevice: builder.mutation({
            query: (id) => ({
                url: `/auth/trusted-devices/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['TrustedDevices'],
        }),
        revokeAllTrustedDevices: builder.mutation({
            query: () => ({
                url: '/auth/trusted-devices/revoke-all',
                method: 'POST',
            }),
            invalidatesTags: ['TrustedDevices'],
        }),
    }),
})

export const {
    useSendOtpMutation,
    useVerifyOtpMutation,
    useLoginMutation,
    useLogin2FAMutation,
    useRegisterTenantMutation,
    useGetMeQuery,
    useRefreshTokenMutation,
    useForgotPasswordMutation,
    useResetPasswordMutation,
    useLogoutMutation,
    useSwitchBranchMutation,
    useUpdatePasswordMutation,
    useGenerate2FAMutation,
    useVerify2FAMutation,
    useDisable2FAMutation,
    useGetUsersQuery,
    useGetTrustedDevicesQuery,
    useRevokeTrustedDeviceMutation,
    useRevokeAllTrustedDevicesMutation,
} = authApi
