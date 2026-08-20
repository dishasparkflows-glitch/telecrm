import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useSocketEvent } from './useSocketEvent';
import { notificationApi, useRegisterDeviceMutation } from '../features/notifications/notificationApi';
import { callApi } from '../features/calls/callApi';
import { closeDialer } from '../slices/uiSlice';
import { requestFirebaseNotificationPermission, onMessageListener } from '../utils/firebase';

const getLocalDeviceId = () => {
    let deviceId = localStorage.getItem('sparkcrm_device_id');
    if (!deviceId) {
        deviceId = 'web_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('sparkcrm_device_id', deviceId);
    }
    return deviceId;
};

export function useNotificationsSocket() {
    const dispatch = useDispatch();
    const [registerDevice] = useRegisterDeviceMutation();

    useEffect(() => {
        const initPush = async () => {
            const token = await requestFirebaseNotificationPermission();
            if (token) {
                await registerDevice({
                    deviceId: getLocalDeviceId(),
                    token,
                    platform: 'web',
                    appVersion: '1.0.0'
                }).unwrap().catch(console.error);
            }
        };
        initPush();

        const unsubscribe = onMessageListener((payload) => {
            console.log('🔔 Firebase Foreground Notification:', payload);
            dispatch(notificationApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
            // Also trigger standard UI toast
            window.dispatchEvent(new CustomEvent('app:notification', { 
                detail: { 
                    title: payload.notification?.title, 
                    message: payload.notification?.body, 
                    type: 'info' 
                } 
            }));

            // Show native Chrome notification
            if (Notification.permission === 'granted') {
                new Notification(payload.notification?.title || 'New Notification', {
                    body: payload.notification?.body || '',
                    icon: '/vite.svg'
                });
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [dispatch, registerDevice]);

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
        console.log('📞 call_completed socket event received', data);
        dispatch(callApi.util.invalidateTags([{ type: 'Call', id: 'LIST' }, { type: 'CallLog', id: 'LIST' }]));
        // Safety net: ensure dialer closes even if Dialer component listener missed the event
        dispatch(closeDialer());
    });

    return null; // Return value not needed anymore, kept for backwards compatibility
}
