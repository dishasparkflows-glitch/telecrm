import { useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

export const useSocketEvent = (eventName, callback) => {
    const { subscribe, unsubscribe } = useSocket() || {};
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!subscribe || !unsubscribe) return;
        
        const handler = (...args) => {
            if (savedCallback.current) {
                savedCallback.current(...args);
            }
        };

        subscribe(eventName, handler);
        return () => {
            unsubscribe(eventName, handler);
        };
    }, [eventName, subscribe, unsubscribe]);
};
