import { useDispatch } from 'react-redux';
import { useSocketEvent } from './useSocketEvent';
import { notificationApi } from '../features/notifications/notificationApi';
import { callApi } from '../features/calls/callApi';

export function useNotificationsSocket() {
    const dispatch = useDispatch();

    useSocketEvent('notification', (notification) => {
        console.log('🔔 Real-time notification received:', notification);
        dispatch(notificationApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
        window.dispatchEvent(new CustomEvent('app:notification', { detail: notification }));
    });

    useSocketEvent('call_recording_ready', (data) => {
        console.log('📞 Real-time call recording ready:', data);
        dispatch(callApi.util.invalidateTags([{ type: 'Call', id: 'LIST' }, { type: 'CallLog', id: 'LIST' }]));
    });

    useSocketEvent('call_completed', (data) => {
        dispatch(callApi.util.invalidateTags([{ type: 'Call', id: 'LIST' }, { type: 'CallLog', id: 'LIST' }]));
    });

    return null; // Return value not needed anymore, kept for backwards compatibility
}
