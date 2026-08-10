import { useEffect, useRef } from 'react';
import { io as socketIO } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { notificationApi } from '../features/notifications/notificationApi';

export function useNotificationsSocket() {
    const { token } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const socketRef = useRef(null);

    useEffect(() => {
        if (!token) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        if (socketRef.current) return;

        const url = import.meta.env.VITE_WS_URL || window.location.origin;

        const socket = socketIO(url, {
            path: '/socket.io-notifications',
            auth: { token },
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('🔌 Connected to notification socket');
        });

        socket.on('notification', (notification) => {
            console.log('🔔 Real-time notification received:', notification);
            // Invalidate the Notification LIST cache to trigger a refetch in RTK Query
            dispatch(notificationApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
            
            // Optionally emit a custom event to show a toast in the topbar or app
            window.dispatchEvent(new CustomEvent('app:notification', { detail: notification }));
        });

        socket.on('disconnect', () => {
            console.log('🔌 Disconnected from notification socket');
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [token, dispatch]);

    return socketRef.current;
}
