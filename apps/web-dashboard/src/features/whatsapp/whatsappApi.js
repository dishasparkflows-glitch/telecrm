import { baseApi } from '../api/baseApi'

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
                    const message = response?.data
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
        uploadMedia: builder.mutation({
            query: (data) => ({
                url: '/whatsapp/media',
                method: 'POST',
                body: data,
            }),
        }),
        getMessageMedia: builder.query({
            query: ({ id, download = false }) => ({
                url: `/whatsapp/messages/${id}/media`,
                params: download ? { download: 1 } : undefined,
            }),
        }),
        getChat: builder.query({
            query: (leadId) => `/whatsapp/chat/${leadId}`,
            providesTags: (result, error, leadId) => [{ type: 'WhatsApp', id: leadId }],
        }),
        getTeamInbox: builder.query({
            query: (params) => ({
                url: '/whatsapp/team-inbox',
                params,
            }),
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
    useUploadMediaMutation,
    useGetMessageMediaQuery,
    useLazyGetMessageMediaQuery,
    useGetChatQuery,
    useGetTeamInboxQuery,
    useBroadcastMutation,
    useGetTemplatesQuery,
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
    useSaveWhatsAppConfigMutation,
    useTestWhatsAppConfigMutation,
    useDeleteWhatsAppConfigMutation,
    useManagePhonePoolMutation,
    // QR / Baileys
    useGetQRStatusQuery,
    useQrConnectMutation,
    useQrDisconnectMutation,
} = whatsappApi
