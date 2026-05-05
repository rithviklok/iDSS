import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshOptions {
    intervalMs?: number;
    enabled?: boolean;
}

export function useAutoRefresh(
    fetchFn: () => Promise<void>,
    options: UseAutoRefreshOptions = {}
) {
    const { intervalMs = 15 * 60 * 1000, enabled = true } = options; // 15 minutes
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(intervalMs / 1000);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await fetchFn();
            setLastUpdated(new Date());
            setSecondsUntilRefresh(intervalMs / 1000);
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchFn, intervalMs]);

    useEffect(() => {
        if (!enabled) return;

        // Main refresh interval
        timerRef.current = setInterval(refresh, intervalMs);

        // Countdown timer (update every second)
        countdownRef.current = setInterval(() => {
            setSecondsUntilRefresh(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [refresh, intervalMs, enabled]);

    return {
        lastUpdated,
        isRefreshing,
        secondsUntilRefresh,
        refreshNow: refresh,
    };
}
