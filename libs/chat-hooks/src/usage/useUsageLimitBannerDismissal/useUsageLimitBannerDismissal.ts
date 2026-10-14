import { useCallback, useSyncExternalStore } from 'react';

/*
 * Module-scoped on purpose: the new-chat composer and the conversation
 * composer are separate component trees, so component state would reset when
 * the user sends a first message and moves from one to the other. A page
 * reload clears it, as intended — dismissals are never persisted.
 *
 * The set is replaced, never mutated, so it doubles as the
 * `useSyncExternalStore` snapshot.
 */
let dismissedKeys: ReadonlySet<string> = new Set<string>();
const listeners = new Set<() => void>();

const setDismissedKeys = (next: ReadonlySet<string>): void => {
  dismissedKeys = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): ReadonlySet<string> => dismissedKeys;

export interface UseUsageLimitBannerDismissalResult {
  /** `true` when the banner was dismissed for `key` in this tab. */
  isDismissed: (key: string) => boolean;
  /** Records a dismissal for `key`, hiding every banner that shows it. */
  dismiss: (key: string) => void;
}

/**
 * Tab-lifetime, in-memory record of dismissed usage-banner keys
 * (`${deploymentId}:${period}:${severity}`), shared by every composer.
 */
export const useUsageLimitBannerDismissal =
  (): UseUsageLimitBannerDismissalResult => {
    const keys = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const isDismissed = useCallback((key: string) => keys.has(key), [keys]);

    const dismiss = useCallback((key: string) => {
      if (dismissedKeys.has(key)) return;
      setDismissedKeys(new Set([...dismissedKeys, key]));
    }, []);

    return { isDismissed, dismiss };
  };

/** Clears every recorded dismissal. Test isolation only. */
export const resetUsageLimitBannerDismissals = (): void => {
  setDismissedKeys(new Set<string>());
};
