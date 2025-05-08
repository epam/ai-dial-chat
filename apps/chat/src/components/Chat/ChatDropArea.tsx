import { ReactNode } from 'react';

import { useChatUploadFiles } from '@/src/hooks/useChatUploadFiles';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { FileDropArea } from '@/src/components/Files/FIleDropArea';

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
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );
  const isExternal = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
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

  const handleUploadFiles = useChatUploadFiles();

  const areModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );

  const isDroppable =
    canAttachFiles &&
    !isReplay &&
    !isPlayback &&
    !isExternal &&
    !isConversationBlocksInput &&
    areModelsInstalled;

  return (
    <FileDropArea
      className="min-w-0 shrink grow basis-0 overflow-hidden"
      onDrop={handleUploadFiles}
      droppable={isDroppable}
      disabled={!!talkToConversationId || isSettingsModalOpen}
    >
      {children}
    </FileDropArea>
  );
};
