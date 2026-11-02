import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { useCallback, useMemo, useState } from 'react';

/** The part of a file-manager controller whose unshare action is held back. */
export interface UnshareConfirmationController {
  /** Unshares shared-with-me items at once. */
  onUnshareFiles: (files: DialFile[]) => void;
}

/** Return value of `useUnshareConfirmationState`. */
export interface UnshareConfirmationState<
  T extends UnshareConfirmationController,
> {
  /** The controller with `onUnshareFiles` replaced by a request that waits for `confirm`. */
  controller: T;
  /** Items waiting for confirmation, or `null` when no confirmation is open. */
  pendingItems: DialFile[] | null;
  /** Unshares the pending items with the original `onUnshareFiles` and closes the confirmation. */
  confirm: () => void;
  /** Closes the confirmation without unsharing. */
  cancel: () => void;
}

/**
 * Holds back a file-manager controller's unshare action until the user
 * confirms; the host renders a confirmation while `pendingItems` is set.
 */
export const useUnshareConfirmationState = <
  T extends UnshareConfirmationController,
>(
  controller: T,
): UnshareConfirmationState<T> => {
  const [pendingItems, setPendingItems] = useState<DialFile[] | null>(null);
  const { onUnshareFiles } = controller;

  const requestUnshare = useCallback(
    (files: DialFile[]) => setPendingItems(files),
    [],
  );

  const confirm = useCallback(() => {
    if (pendingItems != null) onUnshareFiles(pendingItems);
    setPendingItems(null);
  }, [pendingItems, onUnshareFiles]);

  const cancel = useCallback(() => setPendingItems(null), []);

  const wrappedController = useMemo(
    () => ({ ...controller, onUnshareFiles: requestUnshare }),
    [controller, requestUnshare],
  );

  return { controller: wrappedController, pendingItems, confirm, cancel };
};
