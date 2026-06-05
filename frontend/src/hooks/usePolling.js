/**
 * Custom hook for polling data at a configurable interval.
 * Auto-stops when a condition is met.
 */

import { useEffect, useRef, useState } from 'react';

export function usePolling(fetchFn, interval = 3000, shouldPoll = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!shouldPoll) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const poll = async () => {
      try {
        setLoading(true);
        const result = await fetchFn();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    poll(); // Initial fetch
    timerRef.current = setInterval(poll, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [shouldPoll, interval]);

  return { data, error, loading };
}

export default usePolling;
