import { ReactNode } from 'react';

import { useChatUploadFiles } from '@/src/hooks/useChatUploadFiles';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors, ModelsSelectors } from '@/src/store/selectors';

import { FileDropArea } from '@/src/components/Files/FileDropArea';

interface ChatDropAreaProps {
  children: ReactNode;
  isSettingsModalOpen?: boolean;
}

export const ChatDropArea = ({
  children,
  isSettingsModalOpen = false,
}: ChatDropAreaProps) => {
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );
  const isConversationBlocksInput = useAppSelector(
    ConversationsSelectors.selectIsSelectedConversationBlocksInput,
  );
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const talkToConversationId = useAppSelector(
    ConversationsSelectors.selectTalkToConversationId,
  );

  const { uploadFiles } = useChatUploadFiles({ preUploadFiles: true });

  const areModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );

  const isDroppable =
    canAttachFiles && !isConversationBlocksInput && areModelsInstalled;

  return (
    <FileDropArea
      className="min-h-0 min-w-0 flex-1"
      onDrop={uploadFiles}
      droppable={isDroppable}
      disabled={!!talkToConversationId || isSettingsModalOpen}
    >
      {children}
    </FileDropArea>
  );
};
