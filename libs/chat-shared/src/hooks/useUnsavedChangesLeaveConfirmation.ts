import { useEffect, useLayoutEffect, useRef } from 'react';
import { useUnsavedChangesInternal } from '../components/UnsavedChangesProvider/unsaved-changes-context';

/** Options of {@link useUnsavedChangesLeaveConfirmation}. */
export interface UnsavedChangesLeaveConfirmationOptions {
  /** Whether a transition is currently held by the host's blocker. */
  isBlocked: boolean;
  /** Lets the held transition continue; runs on Discard changes. */
  onDiscard: () => void;
  /** Drops the held transition; runs on Keep editing or any dismissal. */
  onKeep: () => void;
}

/** Opens the `UnsavedChangesProvider` dialog while a transition is blocked, and closes it unanswered once the transition is gone or the caller unmounts. */
export const useUnsavedChangesLeaveConfirmation = ({
  isBlocked,
  onDiscard,
  onKeep,
}: UnsavedChangesLeaveConfirmationOptions): void => {
  const { open } = useUnsavedChangesInternal();
  const actionsRef = useRef({ onDiscard, onKeep });

  useLayoutEffect(() => {
    actionsRef.current = { onDiscard, onKeep };
  }, [onDiscard, onKeep]);

  /*
   * Keyed on `isBlocked` alone: a router re-creates its blocker object on
   * updates, and re-opening the dialog for the same blocked transition would
   * be redundant. The latest actions are read through the ref when acted on.
   *
   * The cleanup closes the dialog once the blocked transition is gone without
   * an answer — a post-save exit navigated past it or the caller unmounted —
   * so a stale dialog never outlives its blocker. A dialog opened for another
   * request, such as Log out, is left open.
   */
  useEffect(() => {
    if (!isBlocked) return undefined;
    return open({
      onDiscard: () => actionsRef.current.onDiscard(),
      onKeep: () => actionsRef.current.onKeep(),
    });
  }, [isBlocked, open]);
};
