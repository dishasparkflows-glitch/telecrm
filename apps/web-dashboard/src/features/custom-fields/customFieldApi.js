import { baseApi } from '../api/baseApi'

export const customFieldApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getCustomFields: builder.query({
            query: (params) => ({
                url: '/custom-fields',
                params,
            }),
            providesTags: [{ type: 'CustomField', id: 'LIST' }],
        }),
        createCustomField: builder.mutation({
            query: (data) => ({
                url: '/custom-fields',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'CustomField', id: 'LIST' }],
        }),
        updateCustomField: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/custom-fields/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'CustomField', id: 'LIST' }],
        }),
        deleteCustomField: builder.mutation({
            query: (id) => ({
                url: `/custom-fields/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'CustomField', id: 'LIST' }],
        }),
    }),
})

export const {
    useGetCustomFieldsQuery,
    useCreateCustomFieldMutation,
    useUpdateCustomFieldMutation,
    useDeleteCustomFieldMutation,
} = customFieldApi
