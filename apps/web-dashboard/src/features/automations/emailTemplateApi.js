import { baseApi } from '../api/baseApi';

export const emailTemplateApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getEmailTemplates: builder.query({
            query: (params) => ({
                url: '/automations/email-templates',
                params,
            }),
            providesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
        }),
        getEmailTemplate: builder.query({
            query: (id) => `/automations/email-templates/${id}`,
            providesTags: (result, error, id) => [{ type: 'EmailTemplate', id }],
        }),
        createEmailTemplate: builder.mutation({
            query: (data) => ({
                url: '/automations/email-templates',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
        }),
        updateEmailTemplate: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/automations/email-templates/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'EmailTemplate', id }, { type: 'EmailTemplate', id: 'LIST' }],
        }),
        deleteEmailTemplate: builder.mutation({
            query: (id) => ({
                url: `/automations/email-templates/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
        }),
        updateEmailTemplateStatus: builder.mutation({
            query: ({ id, status }) => ({
                url: `/automations/email-templates/${id}/status`,
                method: 'PATCH',
                body: { status },
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'EmailTemplate', id }, { type: 'EmailTemplate', id: 'LIST' }],
        }),
        duplicateEmailTemplate: builder.mutation({
            query: (id) => ({
                url: `/automations/email-templates/${id}/duplicate`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'EmailTemplate', id: 'LIST' }],
        }),
        previewEmailTemplate: builder.mutation({
            query: (id) => ({
                url: `/automations/email-templates/${id}/preview`,
                method: 'POST',
            }),
        }),
    }),
});

export const {
    useGetEmailTemplatesQuery,
    useGetEmailTemplateQuery,
    useCreateEmailTemplateMutation,
    useUpdateEmailTemplateMutation,
    useDeleteEmailTemplateMutation,
    useUpdateEmailTemplateStatusMutation,
    useDuplicateEmailTemplateMutation,
    usePreviewEmailTemplateMutation,
} = emailTemplateApi;
