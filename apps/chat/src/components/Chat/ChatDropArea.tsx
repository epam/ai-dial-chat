import { ReactNode } from 'react';

import { useUploadFilesHandler } from '@/src/hooks/useUploadFilesHandler';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { FileDropArea } from '@/src/components/Files/FIleDropArea';

interface ChatDropAreaProps {
  children: ReactNode;
}

export const ChatDropArea = ({ children }: ChatDropAreaProps) => {
  const availableAttachmentsTypes = useAppSelector(
    ConversationsSelectors.selectAvailableAttachmentsTypes,
  );
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );

  const handleUploadFiles = useUploadFilesHandler(
    getQuickAttachmentsSavingPath(),
    maximumAttachmentsAmount,
    availableAttachmentsTypes,
  );

  return (
    <FileDropArea
      className="min-w-0 shrink grow basis-0 overflow-hidden"
      onDrop={handleUploadFiles}
      droppable={canAttachFiles}
    >
      {children}
    </FileDropArea>
  );
};
