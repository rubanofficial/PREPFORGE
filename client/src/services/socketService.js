import { io } from 'socket.io-client';

/**
 * SOCKET SERVICE (Singleton)
 *
 * One socket connection for the entire browser session.
 * Components/hooks import this and call helpers — they never
 * create their own connections.
 *
 * DEV:  Client on :5173, Vite proxies /socket.io → :5000
 * PROD: Client and server on same origin, no proxy needed
 *
 * In BOTH cases we connect to window.location.origin so the
 * Vite WebSocket proxy (ws: true) handles the upgrade correctly.
 * Set VITE_SOCKET_URL to override (e.g. staging environments).
 */

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

let socket = null;

const socketService = {
    /**
     * Connect to the Socket.io server (idempotent).
     */
    connect() {
        if (socket && socket.connected) return socket;

        // If socket already exists but is disconnected, reuse it
        if (socket) {
            socket.connect();
            return socket;
        }

        socket = io(SOCKET_URL, {
            // Let socket.io use the Vite proxy path (/socket.io)
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('🔌 Socket connected:', socket.id);
        });

        socket.on('connect_error', (err) => {
            console.warn('⚠️ Socket connection error:', err.message);
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
        });

        return socket;
    },

    /**
     * Join the private room for this user so the server can target
     * sync events only to this user's sockets.
     */
    joinUserRoom(userId) {
        if (!userId) return;
        const s = this.connect();
        // If already connected, emit immediately; otherwise socket.io buffers it
        s.emit('join-user-room', userId);
        console.log('🔌 Joining user room:', userId);
    },

    /**
     * Cleanly disconnect the socket (e.g. on logout).
     */
    disconnect() {
        if (socket) {
            socket.disconnect();
            socket = null;
            console.log('🔌 Socket disconnected (manual)');
        }
    },

    /** Raw socket instance — use for .on() / .off() calls */
    get socket() {
        return socket;
    },
};

export default socketService;
