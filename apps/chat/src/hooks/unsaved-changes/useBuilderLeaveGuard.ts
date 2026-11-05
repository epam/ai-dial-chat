import {
  useUnsavedChangesLeaveConfirmation,
  useUnsavedChangesLeaveGuard,
  type UnsavedChangesLeaveGuardResult,
} from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router';

interface BuilderLeaveGuardOptions {
  /** Whether the builder currently holds edits that leaving would discard. */
  isDirty: boolean;
}

type BuilderLeaveGuardResult = Pick<
  UnsavedChangesLeaveGuardResult,
  'allowNextNavigation'
>;

/**
 * Guards a builder page against losing unsaved edits — the react-router edge
 * of the shared unsaved-changes guard in `@epam/ai-dial-chat-shared`. While
 * `isDirty` is `true` it blocks every in-app transition (PUSH, REPLACE and
 * POP) that changes the pathname or search — a hash-only change passes — and
 * opens the shared "Discard unsaved changes?" dialog: **Discard changes**
 * proceeds to the chosen location, **Keep editing** resets the blocker. The
 * shared hooks also register the dirty state, ask the browser to warn before
 * the page unloads unless a confirmed discard (Log out) already allowed it,
 * and close a stale dialog once the blocked transition is gone.
 *
 * A builder's post-save exit, which navigates before its clean state commits,
 * calls `allowNextNavigation` first.
 *
 * Page-level only: react-router supports a single active blocker, so exactly
 * one builder page may call this hook at a time, and only inside an
 * `UnsavedChangesProvider` under a data router.
 */
export const useBuilderLeaveGuard = ({
  isDirty,
}: BuilderLeaveGuardOptions): BuilderLeaveGuardResult => {
  const { shouldBlockLeave, allowNextNavigation } = useUnsavedChangesLeaveGuard(
    { isDirty },
  );

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      shouldBlockLeave(
        currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search,
      ),
    [shouldBlockLeave],
  );

  const blocker = useBlocker(shouldBlock);

  useUnsavedChangesLeaveConfirmation({
    isBlocked: blocker.state === 'blocked',
    onDiscard: () => blocker.proceed?.(),
    onKeep: () => blocker.reset?.(),
  });

  return { allowNextNavigation };
};
