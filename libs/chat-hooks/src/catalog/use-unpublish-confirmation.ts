import { useCallback, useMemo, useState } from 'react';
import { useAsyncConfirmDialog } from '../conversation/useAsyncConfirmDialog/useAsyncConfirmDialog';

/** The entity an unpublish confirmation is open for. */
export interface UnpublishConfirmationPayload {
  /** Display name of the entity, interpolated into the confirmation message. */
  name: string;
  /** Folders the entity may be unpublished from, as `/`-joined paths; `''` is the public root. */
  folders: string[];
}

/** Props for an unpublish confirmation dialog, shaped to spread into `UnpublishConfirmationDialog` from `@epam/ai-dial-publish-panel`. */
export interface UnpublishConfirmationDialogState {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Name of the pending entity, or `''` when closed. */
  name: string;
  /** Folders of the pending entity, or `[]` when closed. */
  folders: string[];
  /** The picked folder when there are several; `null` until one is picked. */
  selectedFolder: string | null;
  /** Records the folder the user picks. */
  onSelectedFolderChange: (folder: string) => void;
  /** Whether the unpublish request is running. */
  isLoading: boolean;
  /** Runs the request for the picked (or only) folder, then closes the dialog. */
  onConfirm: () => Promise<void>;
  /** Closes the dialog unless the request is running. */
  onClose: () => void;
}

/** What `useUnpublishConfirmation` returns. */
export interface UnpublishConfirmationControls<
  T extends UnpublishConfirmationPayload,
> {
  /** Opens the dialog for `payload` with no folder picked; `returnFocusTo` names the element focused after it closes. */
  open: (payload: T, returnFocusTo?: HTMLElement | null) => void;
  /** The entity the dialog is open for, or `null`. */
  pending: T | null;
  /** Dialog props. */
  dialog: UnpublishConfirmationDialogState;
}

/**
 * Owns an unpublish confirmation: the pending entity, the folder pick when it
 * is published to several folders, and the request run on confirm.
 *
 * @param runUnpublish - Sends the request for `folderPath` and reports success or failure itself; a rejection keeps the dialog open.
 */
export const useUnpublishConfirmation = <
  T extends UnpublishConfirmationPayload,
>(
  runUnpublish: (payload: T, folderPath: string) => Promise<void>,
): UnpublishConfirmationControls<T> => {
  const {
    pending,
    isPending,
    isRunning,
    open: openDialog,
    close: closeDialog,
    confirm: confirmDialog,
  } = useAsyncConfirmDialog<T>();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const open = useCallback(
    (payload: T, returnFocusTo?: HTMLElement | null) => {
      setSelectedFolder(null);
      openDialog(payload, returnFocusTo);
    },
    [openDialog],
  );

  const handleClose = useCallback(() => {
    if (isRunning) return;
    closeDialog();
    setSelectedFolder(null);
  }, [closeDialog, isRunning]);

  const handleConfirm = useCallback(async () => {
    await confirmDialog(
      async (payload) => {
        /* One folder needs no pick; several require one, which the disabled confirm button enforces. */
        const folderPath =
          selectedFolder != null
            ? payload.folders.find((folder) => folder === selectedFolder)
            : payload.folders[0];
        /* `''` is the public root and must be sent: only "not found" (`undefined`) aborts, never every falsy value. */
        if (folderPath == null) return;
        await runUnpublish(payload, folderPath);
      },
      () => '',
    );
    setSelectedFolder(null);
  }, [confirmDialog, runUnpublish, selectedFolder]);

  const dialog = useMemo<UnpublishConfirmationDialogState>(
    () => ({
      isOpen: isPending,
      name: pending?.name ?? '',
      folders: pending?.folders ?? [],
      selectedFolder,
      onSelectedFolderChange: setSelectedFolder,
      isLoading: isRunning,
      onConfirm: handleConfirm,
      onClose: handleClose,
    }),
    [handleClose, handleConfirm, isPending, isRunning, pending, selectedFolder],
  );

  return useMemo(() => ({ open, pending, dialog }), [dialog, open, pending]);
};
