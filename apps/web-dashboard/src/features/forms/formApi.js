import { baseApi } from '../api/baseApi'

export const formApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getForms: builder.query({
            query: () => '/forms',
            providesTags: (result) =>
                result?.data
                    ? [...result.data.map(({ _id }) => ({ type: 'Form', id: _id })), { type: 'Form', id: 'LIST' }]
                    : [{ type: 'Form', id: 'LIST' }],
        }),
        getForm: builder.query({
            query: (id) => `/forms/${id}`,
            providesTags: (result, error, id) => [{ type: 'Form', id }],
        }),
        createForm: builder.mutation({
            query: (data) => ({
                url: '/forms',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Form', id: 'LIST' }],
        }),
        updateForm: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/forms/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Form', id }, { type: 'Form', id: 'LIST' }],
        }),
        getSubmissions: builder.query({
            query: ({ id, ...params }) => ({
                url: `/forms/${id}/submissions`,
                params,
            }),
        }),
        deleteForm: builder.mutation({
            query: (id) => ({
                url: `/forms/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Form', id: 'LIST' }],
        }),
    }),
})

export const {
    useGetFormsQuery,
    useGetFormQuery,
    useCreateFormMutation,
    useUpdateFormMutation,
    useGetSubmissionsQuery,
    useDeleteFormMutation,
} = formApi
