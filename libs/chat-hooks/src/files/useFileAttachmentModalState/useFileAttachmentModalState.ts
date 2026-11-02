import type { AttachResult, Attachment } from '@epam/ai-dial-chat-shared';
import { useCallback, useState } from 'react';
import {
  dialFilesToAttachments,
  dialFolderPathToAttachment,
  type DialFileToAttachmentOptions,
} from '../dial-file-to-attachment';

/** Host inputs for pending attachment results. */
export interface UseFileAttachmentModalStateOptions extends DialFileToAttachmentOptions {
  /** Default bucket for selected files. */
  bucket: string;
}
/** Modal visibility and pending composer attachments. */
export interface UseFileAttachmentModalStateResult {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Opens the modal without restoring consumed results. */
  openModal: () => void;
  /** Closes the modal. */
  closeModal: () => void;
  /** Selected results waiting for the composer. */
  pendingAttachments: Attachment[];
  /** Consumes the pending results. */
  clearPendingAttachments: () => void;
  /** Maps selected files and folders, then closes the modal. */
  handleAttach: (result: AttachResult) => void;
}

/** Keeps pending attachment results separate from browsing and selection state. */
export const useFileAttachmentModalState = ({
  bucket,
  resolvePreviewUrl,
}: UseFileAttachmentModalStateOptions): UseFileAttachmentModalStateResult => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>(
    [],
  );

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);
  const clearPendingAttachments = useCallback(
    () => setPendingAttachments([]),
    [],
  );

  const handleAttach = useCallback(
    (result: AttachResult) => {
      const fileAttachments = dialFilesToAttachments(result.files, bucket, {
        resolvePreviewUrl,
      });
      const folderAttachments = result.folderPaths.map(
        dialFolderPathToAttachment,
      );
      setPendingAttachments([...fileAttachments, ...folderAttachments]);
      setIsOpen(false);
    },
    [bucket, resolvePreviewUrl],
  );

  return {
    isOpen,
    openModal,
    closeModal,
    pendingAttachments,
    clearPendingAttachments,
    handleAttach,
  };
};
