import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../lib/logger';

// Consistent async state hook. Every fetching call site should use this so
// loading/empty/error/retry behavior is uniform across the app.
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isEmpty: boolean;
  refetch: () => Promise<void>;
}

export interface UseAsyncOptions<T> {
  immediate?: boolean;
  isEmpty?: (data: T) => boolean;
  scope?: string;
  deps?: React.DependencyList;
}

export function useAsync<T>(
  fetcher: () => Promise<T>,
  { immediate = true, isEmpty, scope = 'useAsync', deps = [] }: UseAsyncOptions<T> = {},
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (!mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (!mountedRef.current) return;
      const normalized = err instanceof Error ? err : new Error(String(err));
      logger.error(normalized, { scope });
      setError(normalized);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // fetcher is intentionally excluded — callers control invalidation via deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, ...deps]);

  useEffect(() => {
    if (immediate) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, immediate]);

  const emptyFlag = data !== null && isEmpty ? isEmpty(data) : data === null;

  return { data, loading, error, isEmpty: emptyFlag, refetch: run };
}
