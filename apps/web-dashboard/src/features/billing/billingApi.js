import { baseApi } from '../api/baseApi'

export const billingApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getActivePaymentMethods: builder.query({
            query: () => '/billing/available-methods',
        }),
        getPaymentStatus: builder.query({
            query: (invoiceId) => `/billing/payment-status/${invoiceId}`,
        }),
        // Billing
        createSubscription: builder.mutation({
            query: (data) => ({
                url: '/billing/subscribe',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Billing', 'Tenant'],
        }),
        verifyPayment: builder.mutation({
            query: (data) => ({
                url: '/billing/verify-payment',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Billing', 'Tenant'],
        }),
        getInvoices: builder.query({
            query: (params) => ({
                url: '/billing/invoices',
                params,
            }),
            providesTags: [{ type: 'Billing', id: 'INVOICES' }],
        }),
        getInvoice: builder.query({
            query: (id) => `/billing/invoices/${id}`,
        }),
        // Features
        getFeatureStore: builder.query({
            query: () => '/features/store',
            providesTags: [{ type: 'Feature', id: 'STORE' }],
        }),
        getPurchasedFeatures: builder.query({
            query: () => '/features/purchased',
            providesTags: [{ type: 'Feature', id: 'PURCHASED' }],
        }),
        purchaseFeature: builder.mutation({
            query: (data) => ({
                url: '/features/purchase',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Feature', id: 'PURCHASED' }, { type: 'Feature', id: 'STORE' }],
        }),
        activateFeature: builder.mutation({
            query: (data) => ({
                url: '/features/activate',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Feature', id: 'PURCHASED' }],
        }),
        cancelFeature: builder.mutation({
            query: (data) => ({
                url: '/features/cancel',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Feature', id: 'PURCHASED' }, { type: 'Feature', id: 'STORE' }],
        }),
    }),
})

export const {
    useGetActivePaymentMethodsQuery,
    useGetPaymentStatusQuery,
    useCreateSubscriptionMutation,
    useVerifyPaymentMutation,
    useGetInvoicesQuery,
    useGetInvoiceQuery,
    useGetFeatureStoreQuery,
    useGetPurchasedFeaturesQuery,
    usePurchaseFeatureMutation,
    useActivateFeatureMutation,
    useCancelFeatureMutation,
} = billingApi
