import { baseApi } from '../api/baseApi'

export const leadApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getLeads: builder.query({
            query: (params) => ({
                url: '/leads',
                params,
            }),
            providesTags: (result) =>
                result?.data
                    ? [...result.data.map(({ _id }) => ({ type: 'Lead', id: _id })), { type: 'Lead', id: 'LIST' }]
                    : [{ type: 'Lead', id: 'LIST' }],
        }),
        getLeadsExport: builder.query({
            query: (params) => ({
                url: '/leads/export-data',
                params,
            }),
        }),
        getActiveLeads: builder.query({
            query: (params) => ({
                url: '/leads/compact',
                params,
            }),
            serializeQueryArgs: ({ endpointName, queryArgs }) => {
                return `${endpointName}-${queryArgs.search || ''}`;
            },
            merge: (currentCache, newItems, { arg }) => {
                if (arg.page === 1) {
                    return newItems;
                }
                if (newItems.data) {
                    currentCache.data.push(...newItems.data);
                    currentCache.pagination = newItems.pagination;
                }
            },
            forceRefetch({ currentArg, previousArg }) {
                return currentArg?.page !== previousArg?.page || currentArg?.search !== previousArg?.search;
            },
            providesTags: (result) =>
                result?.data
                    ? [...result.data.map(({ _id }) => ({ type: 'Lead', id: _id })), { type: 'Lead', id: 'LIST' }]
                    : [{ type: 'Lead', id: 'LIST' }],
        }),
        getLead: builder.query({
            query: (id) => `/leads/${id}`,
            providesTags: (result, error, id) => [{ type: 'Lead', id }],
        }),
        getLeadStats: builder.query({
            query: () => '/leads/stats',
            providesTags: [{ type: 'Lead', id: 'STATS' }],
        }),
        getLeadTimeline: builder.query({
            query: ({ id, ...params }) => ({
                url: `/leads/${id}/timeline`,
                params,
            }),
            providesTags: (result, error, { id }) => [{ type: 'Lead', id: `${id}-TIMELINE` }],
        }),
        getAssignmentPolicies: builder.query({
            query: () => '/leads/assignment-policies',
            providesTags: [{ type: 'Lead', id: 'ASSIGNMENT_POLICIES' }],
        }),
        getAssignmentPolicy: builder.query({
            query: (params) => ({ url: '/leads/assignment-policy', params }),
            providesTags: [{ type: 'Lead', id: 'ASSIGNMENT_POLICY' }],
        }),
        saveAssignmentPolicy: builder.mutation({
            query: (data) => ({
                url: '/leads/assignment-policy',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'ASSIGNMENT_POLICIES' }, { type: 'Lead', id: 'ASSIGNMENT_POLICY' }],
        }),
        getMetaOAuthUrl: builder.query({
            query: (params) => ({ url: '/leads/oauth/meta/start', params }),
        }),
        getLeadSourceConnections: builder.query({
            query: () => '/leads/source-connections',
            providesTags: [{ type: 'Lead', id: 'SOURCE_CONNECTIONS' }],
        }),
        saveLeadSourceConnection: builder.mutation({
            query: (data) => ({
                url: '/leads/source-connections',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_CONNECTIONS' }],
        }),
        createLeadSourceApiConnection: builder.mutation({
            query: (data) => ({
                url: '/leads/source-api-connections',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_CONNECTIONS' }],
        }),
        rotateLeadSourceApiKey: builder.mutation({
            query: (id) => ({
                url: `/leads/source-api-connections/${id}/rotate-key`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_CONNECTIONS' }],
        }),
        testLeadSourceConnection: builder.mutation({
            query: (id) => ({
                url: `/leads/source-connections/${id}/test`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_CONNECTIONS' }],
        }),
        getMetaPages: builder.query({
            query: (connectionId) => `/leads/source-connections/${connectionId}/meta-pages`,
        }),
        getMetaLeadForms: builder.query({
            query: ({ connectionId, pageId }) => `/leads/source-connections/${connectionId}/meta-pages/${pageId}/forms`,
        }),
        subscribeMetaPage: builder.mutation({
            query: ({ connectionId, pageId }) => ({
                url: `/leads/source-connections/${connectionId}/meta-pages/${pageId}/subscribe`,
                method: 'POST',
            }),
        }),
        getLeadSourceEvents: builder.query({
            query: (params) => ({ url: '/leads/source-events', params }),
            providesTags: [{ type: 'Lead', id: 'SOURCE_EVENTS' }],
        }),
        replayLeadSourceEvent: builder.mutation({
            query: (id) => ({
                url: `/leads/source-events/${id}/replay`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_EVENTS' }, { type: 'Lead', id: 'LIST' }, { type: 'Lead', id: 'STATS' }],
        }),
        getLeadSourceMappings: builder.query({
            query: () => '/leads/source-mappings',
            providesTags: [{ type: 'Lead', id: 'SOURCE_MAPPINGS' }],
        }),
        saveLeadSourceMapping: builder.mutation({
            query: (data) => ({
                url: '/leads/source-mappings',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_MAPPINGS' }],
        }),
        getMetaWebhookConfig: builder.query({
            query: () => '/leads/webhooks/meta/config',
            providesTags: [{ type: 'Lead', id: 'META_WEBHOOK_CONFIG' }],
        }),
        createLead: builder.mutation({
            query: (data) => ({
                url: '/leads',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'LIST' }, { type: 'Lead', id: 'STATS' }],
        }),
        importLeads: builder.mutation({
            query: (formData) => ({
                url: '/leads/import',
                method: 'POST',
                body: formData,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'LIST' }, { type: 'Lead', id: 'STATS' }],
        }),
        updateLead: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/leads/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: `${id}-TIMELINE` }, { type: 'Lead', id: 'LIST' }],
        }),
        bulkUpdateLeads: builder.mutation({
            query: (data) => ({
                url: '/leads/bulk',
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'LIST' }, { type: 'Lead', id: 'STATS' }],
        }),
        addNote: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/leads/${id}/notes`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: `${id}-TIMELINE` }],
        }),
        assignLead: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/leads/${id}/assign`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Lead', id }, { type: 'Lead', id: `${id}-TIMELINE` }, { type: 'Lead', id: 'LIST' }],
        }),
        archiveLead: builder.mutation({
            query: (id) => ({
                url: `/leads/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Lead', id: 'LIST' }, { type: 'Lead', id: 'STATS' }],
        }),
        getGoogleIntegrationAuthStatus: builder.query({
            query: () => '/leads/google/status',
        }),
        getGoogleForms: builder.query({
            query: () => '/leads/google/forms',
        }),
        getGoogleFormFields: builder.query({
            query: (formId) => `/leads/google/forms/${formId}/fields`,
        }),
        getGoogleSpreadsheets: builder.query({
            query: () => '/leads/google/sheets',
        }),
        getGoogleWorksheets: builder.query({
            query: (spreadsheetId) => `/leads/google/sheets/${spreadsheetId}/worksheets`,
        }),
        previewGoogleSheet: builder.query({
            query: ({ spreadsheetId, worksheetName }) => `/leads/google/sheets/${spreadsheetId}/${worksheetName}/preview`,
        }),
        activateGoogleForm: builder.mutation({
            query: (formId) => ({
                url: `/leads/google/forms/${formId}/activate`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_MAPPINGS' }],
        }),
        pauseGoogleForm: builder.mutation({
            query: (formId) => ({
                url: `/leads/google/forms/${formId}/pause`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'Lead', id: 'SOURCE_MAPPINGS' }],
        }),
        syncGoogleForm: builder.mutation({
            query: (formId) => ({
                url: `/leads/google/forms/${formId}/sync`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'Lead', id: 'LIST' }, { type: 'Lead', id: 'STATS' }, { type: 'Lead', id: 'SOURCE_MAPPINGS' }],
        }),
        testGoogleForm: builder.mutation({
            query: (formId) => ({
                url: `/leads/google/forms/${formId}/test`,
                method: 'POST',
            }),
        }),
        importGoogleSheet: builder.mutation({
            query: (data) => ({
                url: `/leads/google/sheets/import`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Lead', id: 'LIST' }, { type: 'Lead', id: 'STATS' }, { type: 'Lead', id: 'SOURCE_MAPPINGS' }],
        }),
    }),
})

export const {
    useGetLeadsQuery,
    useLazyGetLeadsExportQuery,
    useGetActiveLeadsQuery,
    useGetLeadQuery,
    useGetLeadStatsQuery,
    useGetLeadTimelineQuery,
    useGetAssignmentPoliciesQuery,
    useGetAssignmentPolicyQuery,
    useSaveAssignmentPolicyMutation,
    useLazyGetMetaOAuthUrlQuery,
    useGetLeadSourceConnectionsQuery,
    useSaveLeadSourceConnectionMutation,
    useCreateLeadSourceApiConnectionMutation,
    useRotateLeadSourceApiKeyMutation,
    useTestLeadSourceConnectionMutation,
    useGetMetaPagesQuery,
    useGetMetaLeadFormsQuery,
    useSubscribeMetaPageMutation,
    useGetLeadSourceEventsQuery,
    useReplayLeadSourceEventMutation,
    useGetLeadSourceMappingsQuery,
    useSaveLeadSourceMappingMutation,
    useGetMetaWebhookConfigQuery,
    useCreateLeadMutation,
    useImportLeadsMutation,
    useUpdateLeadMutation,
    useBulkUpdateLeadsMutation,
    useAddNoteMutation,
    useAssignLeadMutation,
    useArchiveLeadMutation,
    useGetGoogleIntegrationAuthStatusQuery,
    useGetGoogleFormsQuery,
    useLazyGetGoogleFormFieldsQuery,
    useGetGoogleSpreadsheetsQuery,
    useLazyGetGoogleWorksheetsQuery,
    useLazyPreviewGoogleSheetQuery,
    useActivateGoogleFormMutation,
    usePauseGoogleFormMutation,
    useSyncGoogleFormMutation,
    useTestGoogleFormMutation,
    useImportGoogleSheetMutation,
} = leadApi
