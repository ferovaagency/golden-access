import { useCallback, useState } from 'react';
import { logger } from '../lib/logger';

/**
 * Consistent mutation state hook -- the write-side counterpart to useAsync.
 * Collapses the try/{await fn()}/catch(toastErr)/finally(setSaving(false))
 * pattern repeated across ~8 files (AdminCRM.tsx alone has ~36 instances).
 *
 * Usage:
 *   const { run: saveCliente, loading: saving } = useMutation(
 *     (c: Cliente) => financeService.saveCliente(userId, c),
 *     { onError: toastErr },
 *   );
 *   await saveCliente(cliente);
 */
export interface UseMutationOptions<TResult> {
  onSuccess?: (result: TResult) => void;
  /** Typically `toastErr` from useToast(). Receives an already-readable message. */
  onError?: (message: string) => void;
  scope?: string;
}

export interface MutationState<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>;
  loading: boolean;
  error: Error | null;
}

export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  { onSuccess, onError, scope = 'useMutation' }: UseMutationOptions<TResult> = {},
): MutationState<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      logger.error(normalized, { scope });
      setError(normalized);
      onError?.(normalized.message);
      return undefined;
    } finally {
      setLoading(false);
    }
    // fn/onSuccess/onError intentionally excluded, same convention as useAsync:
    // callers usually pass fresh closures each render, and this hook doesn't
    // need referential stability to behave correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return { run, loading, error };
}
