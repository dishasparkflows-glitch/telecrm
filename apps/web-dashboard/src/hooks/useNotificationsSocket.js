import { useEffect, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { notificationApi } from '../features/notifications/notificationApi';
import { callApi } from '../features/calls/callApi';

let globalSocket = null;
let subscribersCount = 0;

export function useNotificationsSocket() {
    const { token } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const [socketInstance, setSocketInstance] = useState(globalSocket);

    useEffect(() => {
        if (!token) {
            if (globalSocket) {
                globalSocket.disconnect();
                globalSocket = null;
                // eslint-disable-next-line
                setSocketInstance(null);
            }
            return;
        }

        if (!globalSocket) {
            const url = import.meta.env.VITE_WS_URL || window.location.origin;

            globalSocket = socketIO(url, {
                path: '/socket.io-notifications',
                auth: { token },
            });

            globalSocket.on('connect', () => {
                console.log('🔌 Connected to notification socket');
            });

            globalSocket.on('notification', (notification) => {
                console.log('🔔 Real-time notification received:', notification);
                dispatch(notificationApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
                window.dispatchEvent(new CustomEvent('app:notification', { detail: notification }));
            });

            globalSocket.on('call_recording_ready', (data) => {
                console.log('📞 Real-time call recording ready:', data);
                dispatch(callApi.util.invalidateTags([{ type: 'Call', id: 'LIST' }, { type: 'CallLog', id: 'LIST' }]));
            });

            globalSocket.on('call_completed', (data) => {
                dispatch(callApi.util.invalidateTags([{ type: 'Call', id: 'LIST' }, { type: 'CallLog', id: 'LIST' }]));
            });

            globalSocket.on('disconnect', () => {
                console.log('🔌 Disconnected from notification socket');
            });
        }

        // eslint-disable-next-line
        setSocketInstance(globalSocket);
        subscribersCount++;

        return () => {
            subscribersCount--;
            if (subscribersCount <= 0 && globalSocket) {
                globalSocket.disconnect();
                globalSocket = null;
                subscribersCount = 0;
            }
        };
    }, [token, dispatch]);

    return socketInstance;
}
