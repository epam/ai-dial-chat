import { useUploadFilesHandler } from '@/src/hooks/useUploadFilesHandler';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppSelector } from '@/src/store/hooks';

export const useChatUploadFiles = (
  path: string = getQuickAttachmentsSavingPath(),
) => {
  const availableAttachmentsTypes = useAppSelector(
    ConversationsSelectors.selectAvailableAttachmentsTypes,
  );
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );

  return useUploadFilesHandler(
    path,
    maximumAttachmentsAmount,
    availableAttachmentsTypes,
  );
};
