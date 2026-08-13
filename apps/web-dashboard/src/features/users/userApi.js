import { baseApi } from '../api/baseApi'

export const userApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listUsers: builder.query({
            query: (params) => ({ url: '/users', params }),
            providesTags: ['Users'],
        }),
        getUsers: builder.query({
            query: (params) => ({ url: '/users', params }),
            providesTags: ['Users'],
        }),
        getAllUsersList: builder.query({
            query: () => '/users/compact',
            providesTags: ['Users'],
        }),
        getUser: builder.query({
            query: (id) => `/users/${id}`,
            providesTags: (result, error, id) => [{ type: 'Users', id }],
        }),
        updateUser: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/users/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Users'],
        }),
        updateUserRole: builder.mutation({
            query: ({ id, roleId }) => ({
                url: `/users/${id}/role`,
                method: 'PUT',
                body: { roleId },
            }),
            invalidatesTags: ['Users'],
        }),
        updateUserStatus: builder.mutation({
            query: ({ id, isActive }) => ({
                url: `/users/${id}/status`,
                method: 'PUT',
                body: { isActive },
            }),
            invalidatesTags: ['Users'],
        }),
        inviteUser: builder.mutation({
            query: (data) => ({
                url: '/users/invite',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Users'],
        }),
        deleteUser: builder.mutation({
            query: (id) => ({
                url: `/users/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Users'],
        }),
    }),
})

export const {
    useListUsersQuery,
    useGetUsersQuery,
    useGetAllUsersListQuery,
    useGetUserQuery,
    useUpdateUserMutation,
    useUpdateUserRoleMutation,
    useUpdateUserStatusMutation,
    useInviteUserMutation,
    useDeleteUserMutation,
} = userApi

