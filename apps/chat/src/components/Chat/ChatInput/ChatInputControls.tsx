import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { StartReplayButton } from '../StartReplayButton';
import { AddModelsControl } from './AddModelsControl';
import ChatExternalControls from './ChatExternalControls';

interface Props {
  isNotEmptyConversations: boolean;
  showReplayControls: boolean;
  isModelsInstalled: boolean;
  showScrollDownButton: boolean;
  onScrollDown: () => void;
}

export const ChatInputControls = ({
  isNotEmptyConversations,
  showReplayControls,
  isModelsInstalled,
  showScrollDownButton,
  onScrollDown,
}: Props) => {
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const isExternal = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
  );

  if (showReplayControls && !isNotEmptyConversations) {
    return <StartReplayButton />;
  }

  if (isExternal) {
    return (
      <ChatExternalControls
        conversations={selectedConversations}
        showScrollDownButton={showScrollDownButton}
        onScrollDownClick={onScrollDown}
      />
    );
  }

  if (!isModelsInstalled) {
    return (
      <AddModelsControl
        showScrollDownButton={showScrollDownButton}
        onScrollDown={onScrollDown}
      />
    );
  }

  return null;
};
