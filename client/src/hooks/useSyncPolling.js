import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSyncStatus } from '../features/sync/syncSlice';
import leetcodeService from '../services/leetcodeService';

const POLL_INTERVAL = 2000;

export const useSyncPolling = () => {
    const dispatch = useDispatch();
    const { currentJobId, status } = useSelector((state) => state.sync);
    const pollingRef = useRef(null);

    useEffect(() => {
        const pollStatus = async () => {
            if (!currentJobId) return;
            try {
                const res = await leetcodeService.getSyncStatus(currentJobId);
                if (res && res.data) {
                    const { status: s, progress: p, progressPercent: pp, error } = res.data;
                    dispatch(updateSyncStatus({ status: s, progress: p, progressPercent: pp, error }));
                }
            } catch (err) {
                console.error('Failed to poll sync status', err);
                dispatch(updateSyncStatus({ status: 'failed', error: err.message || 'Polling failed' }));
            }
        };

        if (currentJobId && (status === 'pending' || status === 'active')) {
            if (!pollingRef.current) {
                pollStatus(); // initial poll
                pollingRef.current = setInterval(pollStatus, POLL_INTERVAL);
            }
        } else {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        }

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [currentJobId, status, dispatch]);
};
