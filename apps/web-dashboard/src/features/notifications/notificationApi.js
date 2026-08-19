import { baseApi } from '../api/baseApi'

export const notificationApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getNotifications: builder.query({
            query: (params) => ({
                url: '/notifications',
                params,
            }),
            providesTags: [{ type: 'Notification', id: 'LIST' }],
        }),
        markAsRead: builder.mutation({
            query: (data) => ({
                url: '/notifications/read',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
        }),
        markAllRead: builder.mutation({
            query: (data) => ({
                url: '/notifications/read-all',
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
        }),
        deleteNotification: builder.mutation({
            query: (id) => ({
                url: `/notifications/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Notification', id: 'LIST' }],
        }),
        registerDevice: builder.mutation({
            query: (data) => ({
                url: '/notifications/devices',
                method: 'POST',
                body: data,
            }),
        }),
    }),
})

export const {
    useGetNotificationsQuery,
    useMarkAsReadMutation,
    useMarkAllReadMutation,
    useDeleteNotificationMutation,
    useRegisterDeviceMutation,
} = notificationApi
