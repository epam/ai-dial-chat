import type { Attachment } from '@epam/ai-dial-chat-shared';
import { useCallback, useState } from 'react';
import type { AttachResult } from '../../components/DialFileManagerModal/types/attach-result';
import { dialFilesToAttachments } from '../../utils/dial-file-to-attachment';

export interface UseDialFileManagerStateResult {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  pendingAttachments: Attachment[];
  clearPendingAttachments: () => void;
  handleAttach: (result: AttachResult) => void;
}

export const useDialFileManagerState = (
  bucket: string,
): UseDialFileManagerStateResult => {
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
      setPendingAttachments(dialFilesToAttachments(result.files, bucket));
      setIsOpen(false);
    },
    [bucket],
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
