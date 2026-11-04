import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useUnsavedChangesInternal } from '../components/UnsavedChangesProvider/unsaved-changes-context';

/** Options of {@link useUnsavedChangesLeaveGuard}. */
export interface UnsavedChangesLeaveGuardOptions {
  /** Whether the form currently holds edits that leaving would discard. */
  isDirty: boolean;
}

/** Result of {@link useUnsavedChangesLeaveGuard}. */
export interface UnsavedChangesLeaveGuardResult {
  /**
   * Returns whether a transition must be blocked: `isLeaving` (the host's own
   * "this transition leaves the form" decision) while the form is dirty,
   * unless `allowNextNavigation` armed a bypass, which this call consumes.
   * Stable across renders and reads the latest `isDirty`.
   */
  shouldBlockLeave: (isLeaving: boolean) => boolean;
  /**
   * Lets exactly one following transition through unblocked. Call it right
   * before the form's own post-save exit, while `isDirty` may still be `true`
   * because the clean state has not re-rendered yet.
   */
  allowNextNavigation: () => void;
}

/** Registers the form's dirty state with `UnsavedChangesProvider`, warns before the page unloads while dirty, and returns a router-agnostic block predicate with a one-shot bypass. */
export const useUnsavedChangesLeaveGuard = ({
  isDirty,
}: UnsavedChangesLeaveGuardOptions): UnsavedChangesLeaveGuardResult => {
  const { register, unloadAllowedRef } = useUnsavedChangesInternal();
  const dirtyRef = useRef(isDirty);
  const bypassRef = useRef(false);

  /* Committed before any effect or user event can start a navigation. */
  useLayoutEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => register(isDirty), [register, isDirty]);

  /*
   * Stable and ref-backed, so a router blocker built on it does not
   * re-register on every keystroke and reads the value at navigation time.
   */
  const shouldBlockLeave = useCallback((isLeaving: boolean) => {
    if (bypassRef.current) {
      bypassRef.current = false;
      return false;
    }
    return dirtyRef.current && isLeaving;
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unloadAllowedRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, unloadAllowedRef]);

  const allowNextNavigation = useCallback(() => {
    bypassRef.current = true;
  }, []);

  return { shouldBlockLeave, allowNextNavigation };
};
