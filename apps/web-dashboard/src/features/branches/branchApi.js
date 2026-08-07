import { baseApi } from '../api/baseApi'

export const branchApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listBranches: builder.query({
            query: () => '/branches',
            providesTags: ['Branches'],
        }),
        getBranch: builder.query({
            query: (id) => `/branches/${id}`,
            providesTags: (result, error, id) => [{ type: 'Branches', id }],
        }),
        createBranch: builder.mutation({
            query: (data) => ({
                url: '/branches',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Branches'],
        }),
        updateBranch: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/branches/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Branches'],
        }),
        deleteBranch: builder.mutation({
            query: (id) => ({
                url: `/branches/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Branches'],
        }),
    }),
})

export const {
    useListBranchesQuery,
    useGetBranchQuery,
    useCreateBranchMutation,
    useUpdateBranchMutation,
    useDeleteBranchMutation,
} = branchApi
