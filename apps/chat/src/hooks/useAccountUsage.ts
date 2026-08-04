import type { ModelUsageRowData, UsageWindowData } from '@epam/ai-dial-kit';
import { useCallback, useEffect, useState } from 'react';
import {
  MOCK_USAGE_ROWS,
  MOCK_USAGE_WINDOWS,
} from '../pages/ProfileUsage/mock-usage-data';

export interface UseAccountUsageResult {
  /** Daily/monthly budget windows for the summary card. */
  windows: UsageWindowData[];
  /** Per-model usage rows for the by-model table. */
  rows: ModelUsageRowData[];
  /** `true` while a fetch is in flight. */
  isLoading: boolean;
  /** `true` after the most recent fetch rejected. */
  hasError: boolean;
  /** Re-fetches account usage when no request is in flight. */
  refresh: () => void;
}

/**
 * Account-wide usage/budget summary and by-model breakdown for the Usage settings page.
 *
 * No account usage/budget endpoint exists yet, so this returns the same fixture data as
 * a resolved fetch. Swapping in the real call once it lands only requires replacing the
 * body of `fetchUsage` below — `ProfileUsage` already consumes this hook's loading/error
 * contract and needs no changes.
 */
export const useAccountUsage = (): UseAccountUsageResult => {
  const [windows, setWindows] = useState<UsageWindowData[]>([]);
  const [rows, setRows] = useState<ModelUsageRowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => {
    setRefreshCounter((counter) => counter + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchUsage = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        // TODO: replace with the real account usage/budget fetch once that API lands.
        if (cancelled) return;
        setWindows(MOCK_USAGE_WINDOWS);
        setRows(MOCK_USAGE_ROWS);
      } catch {
        if (cancelled) return;
        setHasError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchUsage();

    return () => {
      cancelled = true;
    };
  }, [refreshCounter]);

  return { windows, rows, isLoading, hasError, refresh };
};
