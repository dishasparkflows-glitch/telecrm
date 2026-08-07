import { baseApi } from '../api/baseApi'

export const moduleApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listModules: builder.query({
            query: () => '/modules',
            providesTags: ['Modules'],
        }),
        listAllModules: builder.query({
            query: () => '/modules?all=true',
            providesTags: ['Modules'],
        }),
        createModule: builder.mutation({
            query: (data) => ({
                url: '/modules',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Modules'],
        }),
        updateModule: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/modules/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Modules'],
        }),
        reorderModules: builder.mutation({
            query: (orders) => ({
                url: '/modules/reorder',
                method: 'PUT',
                body: { orders },
            }),
            invalidatesTags: ['Modules'],
        }),
        deleteModule: builder.mutation({
            query: (id) => ({
                url: `/modules/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Modules'],
        }),
    }),
})

export const {
    useListModulesQuery,
    useListAllModulesQuery,
    useCreateModuleMutation,
    useUpdateModuleMutation,
    useReorderModulesMutation,
    useDeleteModuleMutation,
} = moduleApi
