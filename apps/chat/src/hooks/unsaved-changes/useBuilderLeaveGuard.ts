import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router';
import { useUnsavedChangesInternal } from '../../context/UnsavedChangesContext';

interface BuilderLeaveGuardOptions {
  /** Whether the builder currently holds edits that leaving would discard. */
  isDirty: boolean;
}

interface BuilderLeaveGuardResult {
  /**
   * Lets exactly one following transition through unblocked. Call it right
   * before the builder's own post-save exit, while `isDirty` may still be
   * `true` because the clean state has not re-rendered yet.
   */
  allowNextNavigation: () => void;
}

/**
 * Guards a builder page against losing unsaved edits. While `isDirty` is
 * `true` it blocks every in-app transition (PUSH, REPLACE and POP) that
 * changes the pathname or search — a hash-only change passes — and opens the
 * shared "Discard unsaved changes?" dialog: **Discard changes** proceeds to
 * the chosen location, **Keep editing** resets the blocker. It also asks the
 * browser to warn before the page unloads, unless a confirmed discard (Log
 * out) already allowed it.
 *
 * The latest committed `isDirty` and the one-shot bypass live in refs, so the
 * blocker predicate stays stable — `useBlocker` does not re-register on every
 * keystroke — and reads the value at navigation time. A builder's post-save
 * exit, which navigates before its clean state commits, uses
 * `allowNextNavigation` instead.
 *
 * Page-level only: react-router supports a single active blocker, so exactly
 * one builder page may call this hook at a time, and only inside an
 * `UnsavedChangesProvider` under a data router.
 */
export const useBuilderLeaveGuard = ({
  isDirty,
}: BuilderLeaveGuardOptions): BuilderLeaveGuardResult => {
  const { register, open, unloadAllowedRef } = useUnsavedChangesInternal();
  const dirtyRef = useRef(isDirty);
  const bypassRef = useRef(false);

  /* Committed before any effect or user event can start a navigation. */
  useLayoutEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => register(isDirty), [register, isDirty]);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => {
      if (bypassRef.current) {
        bypassRef.current = false;
        return false;
      }
      return (
        dirtyRef.current &&
        (currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search)
      );
    },
    [],
  );

  const blocker = useBlocker(shouldBlock);
  const blockerRef = useRef(blocker);

  useLayoutEffect(() => {
    blockerRef.current = blocker;
  }, [blocker]);

  /*
   * Keyed on the state alone: the blocker object is re-created on router
   * updates, and re-opening the dialog for the same blocked transition would
   * be redundant. The latest object is read through the ref when acted on.
   *
   * The cleanup closes the dialog once the blocked transition is gone without
   * an answer — a post-save exit navigated past it (the router resets every
   * blocker on a completed navigation) or the builder unmounted — so a stale
   * dialog never outlives the builder and its blocker.
   */
  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    return open({
      onDiscard: () => blockerRef.current.proceed?.(),
      onKeep: () => blockerRef.current.reset?.(),
    });
  }, [blocker.state, open]);

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

  return { allowNextNavigation };
};
