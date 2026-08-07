import { baseApi } from '../api/baseApi'

export const automationApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getRules: builder.query({
            query: (params) => ({
                url: '/automations',
                params,
            }),
            providesTags: (result) =>
                result?.data
                    ? [...result.data.map(({ _id }) => ({ type: 'Automation', id: _id })), { type: 'Automation', id: 'LIST' }]
                    : [{ type: 'Automation', id: 'LIST' }],
        }),
        createRule: builder.mutation({
            query: (data) => ({
                url: '/automations',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Automation', id: 'LIST' }],
        }),
        updateRule: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/automations/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Automation', id }, { type: 'Automation', id: 'LIST' }],
        }),
        deleteRule: builder.mutation({
            query: (id) => ({
                url: `/automations/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Automation', id: 'LIST' }],
        }),
        toggleRule: builder.mutation({
            query: (id) => ({
                url: `/automations/${id}/toggle`,
                method: 'PUT',
            }),
            invalidatesTags: (result, error, id) => [{ type: 'Automation', id }, { type: 'Automation', id: 'LIST' }],
        }),
        getAutomationLogs: builder.query({
            query: (params) => ({
                url: '/automations/logs',
                params,
            }),
        }),
    }),
})

export const {
    useGetRulesQuery,
    useCreateRuleMutation,
    useUpdateRuleMutation,
    useDeleteRuleMutation,
    useToggleRuleMutation,
    useGetAutomationLogsQuery,
} = automationApi
