import { baseApi } from '../api/baseApi'

export const uploadApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getUploadUrl: builder.mutation({
            query: (data) => ({
                url: '/uploads/url',
                method: 'POST',
                body: data,
            }),
        }),
        getDownloadUrl: builder.mutation({
            query: (data) => ({
                url: '/uploads/download-url',
                method: 'POST',
                body: data,
            }),
        }),
    }),
})

export const { useGetUploadUrlMutation, useGetDownloadUrlMutation } = uploadApi
