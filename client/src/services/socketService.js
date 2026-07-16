import { io } from 'socket.io-client';

/**
 * SOCKET SERVICE (Singleton)
 *
 * One socket connection for the entire browser session.
 * Components/hooks import this and call helpers — they never
 * create their own connections.
 *
 * ── URL Resolution ──────────────────────────────────────────────────────────
 * DEV:  VITE_SOCKET_URL is not set → falls back to window.location.origin
 *       → Vite proxy forwards /socket.io to localhost:5000 (ws: true in vite.config.js)
 *
 * PROD: VITE_SOCKET_URL must be set in the Vercel dashboard to the Render URL:
 *       VITE_SOCKET_URL=https://prepforge-29le.onrender.com
 *       Without this, the socket would try to connect to the Vercel CDN
 *       which does NOT run Socket.IO — connections would silently fail.
 * ────────────────────────────────────────────────────────────────────────────
 */

// Detect whether we're running on a deployed (production) environment.
// If VITE_SOCKET_URL is not configured in production, connections will fail silently.
const isProduction = !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1');

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

if (isProduction && !import.meta.env.VITE_SOCKET_URL) {
    console.error(
        '⚠️ [PrepForge] VITE_SOCKET_URL is not set in production!\n' +
        'Socket.IO will try to connect to the Vercel frontend URL which does NOT serve sockets.\n' +
        'Add VITE_SOCKET_URL=https://prepforge-29le.onrender.com to your Vercel environment variables.'
    );
}

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
