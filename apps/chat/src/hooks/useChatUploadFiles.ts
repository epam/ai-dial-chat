import { useUploadFilesHandler } from '@/src/hooks/useUploadFilesHandler';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors, FilesSelectors } from '@/src/store/selectors';

export const useChatUploadFiles = (
  path: string = getQuickAttachmentsSavingPath(),
  selectedAttachmentsAmount?: number,
  skipSelect = false,
) => {
  const availableAttachmentsTypes = useAppSelector(
    ConversationsSelectors.selectAvailableAttachmentsTypes,
  );
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const selectedAttachments = useAppSelector(
    FilesSelectors.selectSelectedFiles,
  );

  return useUploadFilesHandler(
    path,
    selectedAttachmentsAmount ?? selectedAttachments.length,
    maximumAttachmentsAmount,
    availableAttachmentsTypes,
    skipSelect,
    false,
  );
};
