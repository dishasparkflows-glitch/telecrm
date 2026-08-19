import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSelector } from 'react-redux';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { token, user } = useSelector((state) => state.auth);
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    
    // Store event listeners in a ref so they persist across renders
    const listenersRef = useRef(new Map());

    useEffect(() => {
        if (!token || !user) return;

        // Establish the single connection to the central API Gateway
        const socketInstance = io(import.meta.env.VITE_API_URL, {
            path: '/socket.io',
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: Infinity
        });

        socketInstance.on('connect', () => {
            console.log('✅ Connected to central socket server');
            setIsConnected(true);
            
            // Re-attach any listeners that were registered before connection
            listenersRef.current.forEach((callbacks, eventName) => {
                callbacks.forEach(callback => {
                    socketInstance.off(eventName, callback); // prevent dupes
                    socketInstance.on(eventName, callback);
                });
            });
        });

        socketInstance.on('disconnect', () => {
            console.log('🔌 Disconnected from socket server');
            setIsConnected(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
            setSocket(null);
        };
    }, [token, user]);

    const subscribe = (eventName, callback) => {
        if (!listenersRef.current.has(eventName)) {
            listenersRef.current.set(eventName, new Set());
        }
        listenersRef.current.get(eventName).add(callback);

        if (socket && isConnected) {
            socket.on(eventName, callback);
        }
    };

    const unsubscribe = (eventName, callback) => {
        const callbacks = listenersRef.current.get(eventName);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                listenersRef.current.delete(eventName);
            }
        }
        if (socket) {
            socket.off(eventName, callback);
        }
    };

    return (
        <SocketContext.Provider value={{ socket, isConnected, subscribe, unsubscribe }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
