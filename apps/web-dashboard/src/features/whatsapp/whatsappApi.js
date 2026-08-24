import { baseApi } from '../api/baseApi'

export const flattenMessage = (msg) => {
    if (!msg || !msg.message) return msg;
    return {
        _id: msg._id,
        ...msg.message,
        ...msg.media,
        ...msg.provider,
        ...msg.delivery,
        ...msg.automation,
        ...msg.readState,
        meta: msg.meta,
        createdAt: msg.createdAt || msg.meta?.createdAt,
        updatedAt: msg.updatedAt || msg.meta?.updatedAt,
        leadId: msg.leadId,
        userId: msg.userId,
        branchId: msg.branchId,
        tenantId: msg.tenantId,
        replyTo: msg.replyTo,
        isForwarded: msg.isForwarded || msg.message?.isForwarded,
        forwardedFrom: msg.forwardedFrom,
        reactions: msg.reactions,
        templateName: msg.templateName
    };
};

export const whatsappApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        sendMessage: builder.mutation({
            query: (data) => ({
                url: '/whatsapp/send',
                method: 'POST',
                body: data,
            }),
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                try {
                    const { data: response } = await queryFulfilled
                    const message = flattenMessage(response?.data)
                    if (!arg?.leadId || !message?._id) return
                    dispatch(whatsappApi.util.updateQueryData('getChat', arg.leadId, (draft) => {
                        if (!Array.isArray(draft?.data)) return
                        const index = draft.data.findIndex((item) => item._id === message._id)
                        if (index >= 0) draft.data[index] = message
                        else draft.data.push(message)
                    }))
                } catch { /* The mutation error is handled by the calling component. */ }
            },
            // Re-fetch as a consistency fallback after the immediate cache update.
            invalidatesTags: (result, error, arg) => [
                { type: 'WhatsApp', id: arg?.leadId },
                { type: 'WhatsApp', id: 'INBOX' },
            ],
        }),
        replyToMessage: builder.mutation({
            query: ({ id, ...body }) => ({ url: `/whatsapp/messages/${id}/reply`, method: 'POST', body }),
            invalidatesTags: (result) => [
                { type: 'WhatsApp', id: result?.data?.leadId },
                { type: 'WhatsApp', id: 'INBOX' },
            ],
        }),
        forwardMessage: builder.mutation({
            query: ({ id, ...body }) => ({ url: `/whatsapp/messages/${id}/forward`, method: 'POST', body }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'INBOX' }],
        }),
        reactToMessage: builder.mutation({
            query: ({ id, emoji }) => ({ url: `/whatsapp/messages/${id}/reaction`, method: 'PUT', body: { emoji } }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'INBOX' }],
        }),

        getMessageMedia: builder.query({
            query: ({ id, download = false }) => ({
                url: `/whatsapp/messages/${id}/media`,
                params: download ? { download: 1 } : undefined,
            }),
        }),
        getChat: builder.query({
            query: (leadId) => `/whatsapp/chat/${leadId}`,
            transformResponse: (response) => {
                if (response?.data) {
                    return { ...response, data: response.data.map(flattenMessage) };
                }
                return response;
            },
            providesTags: (result, error, leadId) => [{ type: 'WhatsApp', id: leadId }],
        }),
        getTeamInbox: builder.query({
            query: (params) => ({
                url: '/whatsapp/team-inbox',
                params,
            }),
            transformResponse: (response) => {
                if (response?.data) {
                    return {
                        ...response,
                        data: response.data.map(conv => {
                            if (conv.lastMessage) return { ...conv, lastMessage: flattenMessage(conv.lastMessage) };
                            return conv;
                        })
                    };
                }
                return response;
            },
            providesTags: [{ type: 'WhatsApp', id: 'INBOX' }],
        }),
        broadcast: builder.mutation({
            query: (data) => ({
                url: '/whatsapp/broadcast',
                method: 'POST',
                body: data,
            }),
        }),
        getTemplates: builder.query({
            query: () => '/whatsapp/templates',
            providesTags: [{ type: 'WhatsApp', id: 'TEMPLATES' }],
        }),
        getApprovedTemplates: builder.query({
            query: () => '/whatsapp/templates/approved',
            providesTags: [{ type: 'WhatsApp', id: 'TEMPLATES' }],
        }),
        createTemplate: builder.mutation({
            query: (data) => ({
                url: '/whatsapp/templates',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'TEMPLATES' }],
        }),
        updateTemplate: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/whatsapp/templates/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'TEMPLATES' }],
        }),
        deleteTemplate: builder.mutation({
            query: (id) => ({
                url: `/whatsapp/templates/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'TEMPLATES' }],
        }),
        getChatbotRules: builder.query({
            query: () => '/whatsapp/chatbot',
            providesTags: [{ type: 'WhatsApp', id: 'CHATBOT' }],
        }),
        createChatbotRule: builder.mutation({
            query: (data) => ({
                url: '/whatsapp/chatbot',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'CHATBOT' }],
        }),
        updateChatbotRule: builder.mutation({
            query: ({ id, ...data }) => ({
                url: `/whatsapp/chatbot/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'CHATBOT' }],
        }),
        deleteChatbotRule: builder.mutation({
            query: (id) => ({
                url: `/whatsapp/chatbot/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'CHATBOT' }],
        }),
        syncTemplates: builder.mutation({
            query: () => ({
                url: '/whatsapp/templates/sync',
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'TEMPLATES' }],
        }),
        getInboxChat: builder.query({
            query: (phone) => `/whatsapp/inbox-chat/${encodeURIComponent(phone)}`,
            transformResponse: (response) => {
                if (response?.data) {
                    return { ...response, data: response.data.map(flattenMessage) };
                }
                return response;
            },
            providesTags: (result, error, phone) => [{ type: 'WhatsApp', id: `INBOX_${phone}` }],
        }),
        markInboxRead: builder.mutation({
            query: (phone) => ({
                url: `/whatsapp/inbox-chat/${encodeURIComponent(phone)}/read`,
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'INBOX' }],
        }),

        // ── WhatsApp Setup Config ─────────────────────────────────────────────
        getWhatsAppConfig: builder.query({
            query: () => '/whatsapp/config',
            providesTags: [{ type: 'WhatsApp', id: 'CONFIG' }],
        }),
        getWhatsAppStats: builder.query({
            query: () => '/whatsapp/stats',
            providesTags: ['WhatsAppStats'],
        }),
        saveWhatsAppConfig: builder.mutation({
            query: (data) => ({
                url: '/whatsapp/config',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'CONFIG' }],
        }),
        testWhatsAppConfig: builder.mutation({
            query: () => ({
                url: '/whatsapp/config/test',
                method: 'POST',
            }),
        }),
        deleteWhatsAppConfig: builder.mutation({
            query: () => ({
                url: '/whatsapp/config',
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'CONFIG' }],
        }),
        managePhonePool: builder.mutation({
            query: (data) => ({
                url: '/whatsapp/config/phone-pool',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'CONFIG' }],
        }),

        // ── QR (Baileys) Connection ───────────────────────────────────────────
        getQRStatus: builder.query({
            query: () => '/whatsapp/qr/status',
            providesTags: [{ type: 'WhatsApp', id: 'QR_STATUS' }],
        }),
        qrConnect: builder.mutation({
            query: () => ({
                url: '/whatsapp/qr/connect',
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'QR_STATUS' }],
        }),
        qrDisconnect: builder.mutation({
            query: () => ({
                url: '/whatsapp/qr/disconnect',
                method: 'POST',
            }),
            invalidatesTags: [{ type: 'WhatsApp', id: 'QR_STATUS' }],
        }),
    }),
})

export const {
    useSendMessageMutation,
    useReplyToMessageMutation,
    useForwardMessageMutation,
    useReactToMessageMutation,
    useGetMessageMediaQuery,
    useLazyGetMessageMediaQuery,
    useGetChatQuery,
    useGetTeamInboxQuery,
    useBroadcastMutation,
    useGetTemplatesQuery,
    useGetApprovedTemplatesQuery,
    useCreateTemplateMutation,
    useUpdateTemplateMutation,
    useDeleteTemplateMutation,
    useGetChatbotRulesQuery,
    useCreateChatbotRuleMutation,
    useUpdateChatbotRuleMutation,
    useDeleteChatbotRuleMutation,
    useSyncTemplatesMutation,
    useGetInboxChatQuery,
    useMarkInboxReadMutation,
    // WhatsApp Setup
    useGetWhatsAppConfigQuery,
    useGetWhatsAppStatsQuery,
    useSaveWhatsAppConfigMutation,
    useTestWhatsAppConfigMutation,
    useDeleteWhatsAppConfigMutation,
    useManagePhonePoolMutation,
    // QR / Baileys
    useGetQRStatusQuery,
    useQrConnectMutation,
    useQrDisconnectMutation,
} = whatsappApi
