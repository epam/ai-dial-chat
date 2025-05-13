import { useUploadFilesHandler } from '@/src/hooks/useUploadFilesHandler';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppSelector } from '@/src/store/hooks';

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
  );
};
