import { useMemo } from 'react';
import { useGetCalendarMeetingsQuery } from '../features/meetings/meetingApi';
import { useGetCalendarTasksQuery } from '../features/tasks/tasksApi';
import { useGetCalendarFollowUpsQuery } from '../features/leads/followUpApi';

export function useCalendarEvents(dateRange) {
    const { from, to } = dateRange;

    const fromDate = from ? from.split('T')[0] : from;
    const toDate = to ? to.split('T')[0] : to;

    // Fetch Meetings
    const { data: meetingsData, isLoading: meetingsLoading, error: meetingsError } = useGetCalendarMeetingsQuery(
        { from: fromDate, to: toDate },
        { skip: !fromDate || !toDate }
    );

    // Fetch Tasks
    const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useGetCalendarTasksQuery(
        { from: fromDate, to: toDate },
        { skip: !fromDate || !toDate }
    );

    // Fetch Follow-ups
    const { data: followUpsData, isLoading: followUpsLoading, error: followUpsError } = useGetCalendarFollowUpsQuery(
        { from: fromDate, to: toDate },
        { skip: !fromDate || !toDate }
    );

    const events = useMemo(() => {
        const result = [];

        // Map Meetings
        if (meetingsData?.data) {
            meetingsData.data.forEach(m => {
                if (!m.meeting?.scheduledAt) return;
                
                const start = new Date(m.meeting.scheduledAt);
                const end = new Date(start.getTime() + (m.meeting.duration || 30) * 60000);
                
                let bgColor = '#eff6ff'; // blue-50
                let textColor = '#1d4ed8'; // blue-700
                let borderColor = '#bfdbfe'; // blue-200

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
                    title: t.details?.title || t.title || 'Task',
                    start: start,
                    end: end,
                    backgroundColor: '#f0fdf4', // green-50
                    borderColor: '#bbf7d0', // green-200
                    textColor: '#15803d', // green-700
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
                    backgroundColor: '#fffbeb', // amber-50
                    borderColor: '#fde68a', // amber-200
                    textColor: '#b45309', // amber-700
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
