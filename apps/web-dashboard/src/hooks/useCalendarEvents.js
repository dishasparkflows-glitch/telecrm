import { useMemo } from 'react';
import { useGetMeetingsQuery } from '../features/meetings/meetingApi';
import { useListTasksQuery } from '../features/tasks/tasksApi';
import { useGetFollowUpsQuery } from '../features/leads/followUpApi';

export function useCalendarEvents(dateRange) {
    const { from, to } = dateRange;

    // Fetch Meetings
    const { data: meetingsData, isLoading: meetingsLoading, error: meetingsError } = useGetMeetingsQuery(
        { from, to, limit: 1000 },
        { skip: !from || !to }
    );

    // Fetch Tasks
    const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useListTasksQuery(
        { from, to, limit: 1000 },
        { skip: !from || !to }
    );

    // Fetch Follow-ups
    const { data: followUpsData, isLoading: followUpsLoading, error: followUpsError } = useGetFollowUpsQuery(
        { from, to, limit: 1000 },
        { skip: !from || !to }
    );

    const events = useMemo(() => {
        const result = [];

        // Map Meetings
        if (meetingsData?.data) {
            meetingsData.data.forEach(m => {
                if (!m.meeting?.scheduledAt) return;
                
                const start = new Date(m.meeting.scheduledAt);
                const end = new Date(start.getTime() + (m.meeting.duration || 30) * 60000);
                
                let bgColor = '#f3f4f6';
                let textColor = '#374151';
                let borderColor = '#e5e7eb';
                
                if (m.leadId) {
                    bgColor = '#f0fdf4'; // green-50
                    textColor = '#15803d'; // green-700
                    borderColor = '#bbf7d0'; // green-200
                } else {
                    bgColor = '#faf5ff'; // purple-50
                    textColor = '#7e22ce'; // purple-700
                    borderColor = '#e9d5ff'; // purple-200
                }

                if (m.meeting.title?.toLowerCase().includes('demo') || m.meeting.title?.toLowerCase().includes('discussion')) {
                    bgColor = '#fefce8'; // yellow-50
                    textColor = '#a16207'; // yellow-700
                    borderColor = '#fef08a'; // yellow-200
                }

                result.push({
                    id: `meeting-${m._id}`,
                    title: m.meeting.title || 'Untitled Meeting',
                    start: start,
                    end: end,
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                    textColor: textColor,
                    extendedProps: {
                        type: 'meeting',
                        data: m
                    }
                });
            });
        }

        // Map Tasks
        if (tasksData?.data?.tasks) {
            tasksData.data.tasks.forEach(t => {
                if (!t.dueDate) return;
                
                const start = new Date(t.dueDate);
                const end = new Date(start.getTime() + 30 * 60000); // 30 min duration for tasks on calendar

                result.push({
                    id: `task-${t._id}`,
                    title: t.title || 'Task',
                    start: start,
                    end: end,
                    backgroundColor: '#eff6ff',
                    borderColor: '#bfdbfe',
                    textColor: '#1d4ed8',
                    extendedProps: {
                        type: 'task',
                        data: t
                    }
                });
            });
        }

        // Map Follow-ups
        if (followUpsData?.data) {
            followUpsData.data.forEach(f => {
                if (!f.scheduledAt) return;
                
                const start = new Date(f.scheduledAt);
                const end = new Date(start.getTime() + 30 * 60000); // 30 min duration

                result.push({
                    id: `followup-${f._id}`,
                    title: `Follow-up: ${f.leadId?.name || 'Lead'}`,
                    start: start,
                    end: end,
                    backgroundColor: '#fff7ed', // orange-50
                    borderColor: '#fed7aa', // orange-200
                    textColor: '#c2410c', // orange-700
                    extendedProps: {
                        type: 'followup',
                        data: f
                    }
                });
            });
        }

        return result;
    }, [meetingsData, tasksData, followUpsData]);

    return {
        events,
        isLoading: meetingsLoading || tasksLoading || followUpsLoading,
        error: meetingsError || tasksError || followUpsError
    };
}
