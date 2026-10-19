/**
 * Custom hook for polling data at a configurable interval.
 *
 * Uses a chained timeout instead of setInterval so a slow response can never
 * stack overlapping requests, and aborts in-flight work on unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolling(fetchFn, interval = 3000, shouldPoll = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Keep the latest callback without restarting the timer on every render.
  const fetchRef = useRef(fetchFn);
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const timeoutRef = useRef(null);
  const controllerRef = useRef(null);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!shouldPoll) {
      stop();
      return undefined;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      controllerRef.current = new AbortController();
      try {
        setLoading(true);
        const result = await fetchRef.current(controllerRef.current.signal);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        // Aborts are expected during unmount / dependency changes.
        if (cancelled || err.name === 'CanceledError' || err.name === 'AbortError') {
          return;
        }
        setError(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          timeoutRef.current = setTimeout(poll, interval);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      stop();
    };
  }, [shouldPoll, interval, stop]);

  return { data, error, loading, stop };
}

export default usePolling;
