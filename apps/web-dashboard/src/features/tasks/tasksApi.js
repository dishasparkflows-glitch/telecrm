import { baseApi } from '../api/baseApi'

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTasks: builder.query({
      query: (params) => ({
        url: '/tasks',
        params,
      }),
      providesTags: ['Task'],
    }),
    getCalendarTasks: builder.query({
      query: (params) => ({
        url: '/tasks/calendar',
        params,
      }),
      providesTags: ['Task'],
    }),
    getTaskStats: builder.query({
      query: () => '/tasks/stats',
      providesTags: ['TaskStats'],
    }),
    createTask: builder.mutation({
      query: (data) => ({
        url: '/tasks',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Task', 'TaskStats', 'LeadActivities'],
    }),
    updateTask: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/tasks/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Task', 'TaskStats', 'LeadActivities'],
    }),
    updateTaskStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `/tasks/${id}/status`,
        method: 'PATCH',
        body: { details: { status } },
      }),
      invalidatesTags: ['Task', 'TaskStats', 'LeadActivities'],
    }),
    deleteTask: builder.mutation({
      query: (id) => ({
        url: `/tasks/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Task', 'TaskStats', 'LeadActivities'],
    }),
  }),
})

export const {
  useListTasksQuery,
  useGetCalendarTasksQuery,
  useGetTaskStatsQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useUpdateTaskStatusMutation,
  useDeleteTaskMutation,
} = tasksApi
