import { useEffect, useRef } from 'react';

/** Triggers closer than this to the last started load are coalesced. */
export const MIN_CLIENT_CONFIG_REFRESH_GAP_MS = 15_000;
/** The longest a visible tab waits for its next timed refresh. */
export const MAX_CLIENT_CONFIG_REFRESH_DELAY_MS = 15 * 60_000;

/**
 * When to refresh next, measured from the moment the caller stores it. A new
 * object for every accepted response re-arms the timer, even when the server
 * returned the same hint again.
 */
export interface ClientConfigRefreshSchedule {
  /** Milliseconds until the next timed refresh. */
  readonly delayMs: number;
}

/**
 * The schedule a response asks for: `nextRefreshAt` relative to the same
 * response's `resolvedAt`, so a browser clock that is off does not matter.
 * `null` when the response carries no hint.
 */
export const scheduleFromResponse = (
  metadata: { resolvedAt?: string; nextRefreshAt?: string } | undefined,
): ClientConfigRefreshSchedule | null => {
  const next = Date.parse(metadata?.nextRefreshAt ?? '');
  const resolved = Date.parse(metadata?.resolvedAt ?? '');
  if (Number.isNaN(next) || Number.isNaN(resolved)) return null;
  return { delayMs: Math.max(0, next - resolved) };
};

/** Inputs of {@link useClientConfigRefresh}. */
export interface UseClientConfigRefreshOptions {
  /**
   * The current schedule. `null` disables every trigger, so a deployment
   * without managed configuration keeps loading client config only on
   * identity changes.
   */
  schedule: ClientConfigRefreshSchedule | null;
  /** Starts a background refresh; the caller cancels and orders loads. */
  refresh: () => void;
  /** When the caller last started a load (epoch ms), for coalescing. */
  getLastLoadStartedAt: () => number;
}

const isVisible = (): boolean => document.visibilityState === 'visible';

/**
 * Keeps an open tab's client config current while the deployment publishes
 * managed configuration. Without it a long-lived tab would keep a
 * publication, an ended availability window or a stale state until the next
 * sign-in. A visible tab refreshes when the schedule says; returning to the tab
 * (visibility, focus, back-forward-cache restore, reconnect) refreshes at
 * once. A hidden tab schedules nothing, and triggers within 15 seconds of the
 * last load are coalesced so bursts of events cost one request.
 */
export const useClientConfigRefresh = ({
  schedule: refreshSchedule,
  refresh,
  getLastLoadStartedAt,
}: UseClientConfigRefreshOptions): void => {
  /* Latest callbacks, so inline functions do not restart the listeners. */
  const refreshRef = useRef(refresh);
  const lastLoadRef = useRef(getLastLoadStartedAt);
  useEffect(() => {
    refreshRef.current = refresh;
    lastLoadRef.current = getLastLoadStartedAt;
  }, [refresh, getLastLoadStartedAt]);

  useEffect(() => {
    if (refreshSchedule == null) return;
    const target = Date.now() + refreshSchedule.delayMs;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const sinceLastLoad = () => Date.now() - lastLoadRef.current();

    const trigger = () => {
      if (sinceLastLoad() < MIN_CLIENT_CONFIG_REFRESH_GAP_MS) return;
      refreshRef.current();
    };

    const schedule = (delay: number) => {
      clear();
      if (!isVisible()) return;
      timer = setTimeout(
        () => {
          timer = undefined;
          if (!isVisible()) return;
          const wait = MIN_CLIENT_CONFIG_REFRESH_GAP_MS - sinceLastLoad();
          /* A load started meanwhile; check again once the gap has passed. */
          if (wait > 0) {
            schedule(wait);
            return;
          }
          refreshRef.current();
        },
        Math.min(MAX_CLIENT_CONFIG_REFRESH_DELAY_MS, Math.max(0, delay)),
      );
    };
    /* The hinted time, but never sooner than the coalescing gap. */
    const hintedDelay = () =>
      Math.max(MIN_CLIENT_CONFIG_REFRESH_GAP_MS, target - Date.now());

    const handleVisibilityChange = () => {
      if (!isVisible()) {
        clear();
        return;
      }
      trigger();
      schedule(hintedDelay());
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) trigger();
    };

    schedule(hintedDelay());
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', trigger);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', trigger);
    return () => {
      clear();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', trigger);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', trigger);
    };
  }, [refreshSchedule]);
};
