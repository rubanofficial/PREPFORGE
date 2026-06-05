import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSyncStatus } from '../features/sync/syncSlice';
import socketService from '../services/socketService';
import leetcodeService from '../services/leetcodeService';

/**
 * useSyncSocket
 *
 * Primary: Listens for real-time Socket.io events emitted by deepSyncService.
 * Fallback: REST polling every 5 seconds as a safety net for missed socket events.
 *
 * RACE-CONDITION FIX:
 * The polling fallback can fire after the socket already set a higher
 * progressPercent (e.g. 100% from sync-complete). To prevent a stale poll
 * from overwriting a higher value, the dispatcher only updates progressPercent
 * if the incoming value is >= the current value in Redux.
 *
 * EVENTS:
 *  - 'sync-progress'  → live progress update
 *  - 'sync-complete'  → dispatches status: 'completed', progressPercent: 100
 *  - 'sync-failed'    → dispatches status: 'failed'
 */
export const useSyncSocket = () => {
    const dispatch      = useDispatch();
    const userId        = useSelector((state) => state.auth?.user?.userId);
    const syncState     = useSelector((state) => state.sync);
    const { currentJobId, status, progressPercent: currentPercent } = syncState;
    const pollRef       = useRef(null);
    const isTerminal    = status === 'completed' || status === 'failed' || status === 'idle';

    // Keep a ref of the latest progressPercent so the poll closure always
    // sees the current value without needing it as a dependency.
    const currentPercentRef = useRef(currentPercent);
    useEffect(() => { currentPercentRef.current = currentPercent; }, [currentPercent]);

    // ── Socket connection + listeners ─────────────────────────────────────
    useEffect(() => {
        if (!userId) return;

        socketService.connect();
        socketService.joinUserRoom(userId);

        const socket = socketService.socket;
        if (!socket) return;

        // Always accept socket events — they come directly from the background
        // worker and are the ground truth for real-time progress.
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

                    // RACE-CONDITION GUARD:
                    // Only update progressPercent from polling if it is >= the
                    // value already in Redux. This prevents a stale poll
                    // (already in-flight when sync-complete fired) from
                    // overwriting the correct 100%.
                    const safePercent = (pp !== undefined && pp >= currentPercentRef.current)
                        ? pp
                        : currentPercentRef.current;

                    dispatch(updateSyncStatus({
                        status: s,
                        progress: p,
                        progressPercent: safePercent,
                        error,
                    }));
                }
            } catch (err) {
                console.warn('Fallback poll failed:', err.message);
            }
        };

        clearPoll();
        pollRef.current = setInterval(poll, 5000);

        return clearPoll;
    }, [currentJobId, isTerminal, dispatch]);
};
