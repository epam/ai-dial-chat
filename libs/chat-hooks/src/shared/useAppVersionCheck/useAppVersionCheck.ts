import { useEffect, useRef, useState } from 'react';

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/* Vite dispatches this on `window` when a dynamic import's chunk fails to load. */
const PRELOAD_ERROR_EVENT = 'vite:preloadError';

/** Build information the host's health request resolves with. */
export interface AppBuildInfo {
  /** Identifier of the deployed build; an empty or missing value is ignored. */
  buildId?: string | null;
}

/** Inputs of {@link useAppVersionCheck}. */
export interface UseAppVersionCheckOptions {
  /** Reads the deployed build, bound by the host to its health endpoint; it should bypass HTTP caches. */
  checkHealth: (signal: AbortSignal) => Promise<AppBuildInfo>;
  /** Minimum time between checks while the tab stays visible. Defaults to `300000` (5 minutes). */
  pollIntervalMs?: number;
  /** Time after which one health request is aborted. Defaults to `10000`. */
  requestTimeoutMs?: number;
}

/** Result of {@link useAppVersionCheck}. */
export interface UseAppVersionCheckResult {
  /** Whether a different build was deployed, or a chunk of the running build failed to load. */
  isNewVersionAvailable: boolean;
}

/** Reports when a long-lived tab runs a build that is no longer deployed, so the host can prompt a reload. */
export const useAppVersionCheck = ({
  checkHealth,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: UseAppVersionCheckOptions): UseAppVersionCheckResult => {
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);
  const baselineBuildIdRef = useRef<string | null>(null);
  /* Latest request function, so an inline host callback does not restart the checks. */
  const checkHealthRef = useRef(checkHealth);
  checkHealthRef.current = checkHealth;

  useEffect(() => {
    let isStopped = false;
    let requestController: AbortController | null = null;
    let lastInteractionAt = Date.now();

    const handleReturn = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };
    const handleInteraction = () => {
      const now = Date.now();
      if (now - lastInteractionAt >= pollIntervalMs) void checkVersion();
      lastInteractionAt = now;
    };
    const handlePreloadError = (event: Event) => {
      // Recovered by the reload prompt instead of surfacing as a render error.
      event.preventDefault();
      showNewVersion();
    };

    const stopChecking = () => {
      isStopped = true;
      clearInterval(intervalId);
      requestController?.abort();
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleReturn);
      window.removeEventListener('pageshow', handleReturn);
      window.removeEventListener('pointerdown', handleInteraction, true);
      window.removeEventListener('keydown', handleInteraction, true);
      window.removeEventListener(PRELOAD_ERROR_EVENT, handlePreloadError);
    };

    const showNewVersion = () => {
      setIsNewVersionAvailable(true);
      stopChecking();
    };

    const checkVersion = async () => {
      if (isStopped || requestController) return;

      const controller = new AbortController();
      requestController = controller;
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const { buildId } = await checkHealthRef.current(controller.signal);
        if (isStopped || controller.signal.aborted || !buildId) return;

        if (baselineBuildIdRef.current === null) {
          baselineBuildIdRef.current = buildId;
        } else if (buildId !== baselineBuildIdRef.current) {
          showNewVersion();
        }
      } catch {
        // Offline tabs and transient health failures retry on the next check.
      } finally {
        clearTimeout(timeoutId);
        requestController = null;
      }
    };

    /* Declared after the handlers that clear it; none of them runs before this line. */
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') void checkVersion();
    }, pollIntervalMs);

    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleReturn);
    window.addEventListener('pageshow', handleReturn);
    window.addEventListener('pointerdown', handleInteraction, true);
    window.addEventListener('keydown', handleInteraction, true);
    window.addEventListener(PRELOAD_ERROR_EVENT, handlePreloadError);
    void checkVersion();

    return stopChecking;
  }, [pollIntervalMs, requestTimeoutMs]);

  return { isNewVersionAvailable };
};
