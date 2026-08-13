import { baseApi } from '../api/baseApi'

export const roleApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listRoles: builder.query({
            query: () => '/roles',
            providesTags: ['Roles'],
        }),
        listRolesCompact: builder.query({
            query: () => '/roles/compact',
            providesTags: ['Roles'],
        }),
        getRole: builder.query({
            query: (id) => `/roles/${id}`,
            providesTags: (result, error, id) => [{ type: 'Roles', id }],
        }),
        getAvailableModules: builder.query({
            query: () => '/roles/available-modules',
            providesTags: ['Modules'],
        }),
        createRole: builder.mutation({
            query: (data) => ({
                url: '/roles',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Roles'],
        }),
        updateRole: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/roles/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Roles'],
        }),
        updateRolePermissions: builder.mutation({
            query: ({ id, permissions }) => ({
                url: `/roles/${id}/permissions`,
                method: 'PUT',
                body: { permissions },
            }),
            invalidatesTags: ['Roles'],
        }),
        deleteRole: builder.mutation({
            query: (id) => ({
                url: `/roles/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Roles'],
        }),
    }),
})

export const {
    useListRolesQuery,
    useListRolesCompactQuery,
    useGetRoleQuery,
    useGetAvailableModulesQuery,
    useCreateRoleMutation,
    useUpdateRoleMutation,
    useUpdateRolePermissionsMutation,
    useDeleteRoleMutation,
} = roleApi
