import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSyncStatus } from '../features/sync/syncSlice';
import socketService from '../services/socketService';
import leetcodeService from '../services/leetcodeService';

/**
 * useSyncSocket
 *
 * Primary: Listens for real-time Socket.io events emitted by deepSyncService.
 * Fallback: If the socket misses the final event (server restart, lost packet),
 *           polls once via REST 3 seconds after status goes to pending/active
 *           and every 5 seconds until terminal state.
 *
 * EVENTS:
 *  - 'sync-progress'  → live progress update
 *  - 'sync-complete'  → dispatches status: 'completed', progressPercent: 100
 *  - 'sync-failed'    → dispatches status: 'failed'
 */
export const useSyncSocket = () => {
    const dispatch   = useDispatch();
    const userId     = useSelector((state) => state.auth?.user?.userId);
    const { currentJobId, status } = useSelector((state) => state.sync);
    const pollRef    = useRef(null);
    const isTerminal = status === 'completed' || status === 'failed' || status === 'idle';

    // ── Socket connection + listeners ─────────────────────────────────────
    useEffect(() => {
        if (!userId) return;

        socketService.connect();
        socketService.joinUserRoom(userId);

        const socket = socketService.socket;
        if (!socket) return;

        const onProgress = ({ status: s, progress, progressPercent }) => {
            dispatch(updateSyncStatus({ status: s, progress, progressPercent }));
        };

        const onComplete = ({ status: s, progress, progressPercent }) => {
            dispatch(updateSyncStatus({ status: s, progress, progressPercent }));
        };

        const onFailed = ({ status: s, error, progressPercent }) => {
            dispatch(updateSyncStatus({ status: s, error, progressPercent }));
        };

        socket.on('sync-progress', onProgress);
        socket.on('sync-complete', onComplete);
        socket.on('sync-failed',   onFailed);

        return () => {
            socket.off('sync-progress', onProgress);
            socket.off('sync-complete', onComplete);
            socket.off('sync-failed',   onFailed);
        };
    }, [userId, dispatch]);

    // ── Fallback REST polling (safety net) ────────────────────────────────
    // Runs only when there's an active job and the socket might have missed
    // the terminal event. Stops as soon as a terminal state is reached.
    useEffect(() => {
        const clearPoll = () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };

        if (!currentJobId || isTerminal) {
            clearPoll();
            return;
        }

        const poll = async () => {
            try {
                const res = await leetcodeService.getSyncStatus(currentJobId);
                if (res?.data) {
                    const { status: s, progress: p, progressPercent: pp, error } = res.data;
                    dispatch(updateSyncStatus({ status: s, progress: p, progressPercent: pp, error }));
                }
            } catch (err) {
                console.warn('Fallback poll failed:', err.message);
            }
        };

        // Start polling every 5 seconds as a safety net
        clearPoll();
        pollRef.current = setInterval(poll, 5000);

        return clearPoll;
    }, [currentJobId, isTerminal, dispatch]);
};
