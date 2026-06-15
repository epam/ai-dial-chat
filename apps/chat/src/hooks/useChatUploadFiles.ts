import {
  DispatchPreparedFilesOptions,
  useUploadFilesHandler,
} from '@/src/hooks/useUploadFilesHandler';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors, FilesSelectors } from '@/src/store/selectors';

interface ChatUploadFilesProps {
  path?: string;
  selectedAttachmentsAmount?: number;
  skipSelect?: boolean;
  preUploadFiles?: boolean;
}

export const useChatUploadFiles = ({
  path = getQuickAttachmentsSavingPath(),
  selectedAttachmentsAmount,
  skipSelect = false,
  preUploadFiles = false,
}: ChatUploadFilesProps = {}) => {
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
    preUploadFiles,
  );
};

export type { DispatchPreparedFilesOptions };
