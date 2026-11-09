import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useRef, useState } from 'react';
import { getApiErrorDetails } from '../api-error/api-error';

/** Host behaviour the removal delegates to. */
export interface ProjectRemoveFromListHandlers {
  /** Discards the caller's own access to the project; rejects on failure. */
  discardShared: (projectId: string) => Promise<unknown>;
  /** Persists the pin state; rejects on failure. */
  setPinned: (projectId: string, isPinned: boolean) => Promise<void>;
  /** Called when the unpin could not be saved, so the host can mirror it locally and the entry still leaves the sidebar. */
  onUnpinFailed?: (project: ProjectDetailsDto) => void;
  /** Called after the project left the caller's list; the host notifies and navigates away. */
  onRemoved: (project: ProjectDetailsDto) => void;
  /** Called when the discard failed, with the request's trace id; the host shows the message. */
  onError: (project: ProjectDetailsDto, requestId?: string) => void;
  /** Called once the request settles, whether it succeeded or failed, so the host can close its confirmation. */
  onSettled?: () => void;
}

/**
 * Drops a project shared with the caller from their own list: discards only
 * the caller's access, then unpins it. The owner's project and the other
 * recipients' access are untouched. Messages, notifications and navigation
 * stay with the host through `handlers`.
 *
 * @param project - The project to remove, or `null` while none is chosen.
 * @param handlers - Host behaviour the removal delegates to.
 */
export const useProjectRemoveFromList = (
  project: ProjectDetailsDto | null,
  {
    discardShared,
    setPinned,
    onUnpinFailed,
    onRemoved,
    onError,
    onSettled,
  }: ProjectRemoveFromListHandlers,
) => {
  const [isRemoving, setIsRemoving] = useState(false);
  /* A second confirm lands before the first render shows `isRemoving`. */
  const isInFlightRef = useRef(false);

  const confirmRemove = useCallback(async () => {
    if (project == null || isInFlightRef.current) return;
    isInFlightRef.current = true;
    setIsRemoving(true);
    const settle = () => {
      isInFlightRef.current = false;
      setIsRemoving(false);
      onSettled?.();
    };
    try {
      await discardShared(project.id);
    } catch (err) {
      const { traceId } = await getApiErrorDetails(err);
      onError(project, traceId);
      settle();
      return;
    }
    /* The pin is only housekeeping: a failed write must not turn the removal into an error. */
    try {
      await setPinned(project.id, false);
    } catch {
      onUnpinFailed?.(project);
    }
    settle();
    onRemoved(project);
  }, [
    project,
    discardShared,
    setPinned,
    onUnpinFailed,
    onRemoved,
    onError,
    onSettled,
  ]);

  return { isRemoving, confirmRemove };
};
