import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { SchemaCompareWarning } from '@/src/components/Chat/ChatInput/SchemaCompareWarning';
import { StartReplayButton } from '@/src/components/Chat/StartReplayButton';

import { AddModelsControl } from './AddModelsControl';
import { ChatExternalControls } from './ChatExternalControls';

interface Props {
  isNotEmptyConversations: boolean;
  showReplayControls: boolean;
  areModelsInstalled: boolean;
  isConversationWithSchema: boolean;
  showScrollDownButton: boolean;
  isWideLayout?: boolean;
  onScrollDown: () => void;
}

export const ChatInputControls = ({
  isNotEmptyConversations,
  showReplayControls,
  areModelsInstalled,
  isConversationWithSchema,
  showScrollDownButton,
  isWideLayout,
  onScrollDown,
}: Props) => {
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const isExternal = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsExternal,
  );

  if (isConversationWithSchema && selectedConversations.length > 1) {
    return <SchemaCompareWarning />;
  }

  if (showReplayControls && !isNotEmptyConversations) {
    return (
      <div
        className={classNames({
          'mt-10': isWideLayout,
        })}
      >
        <StartReplayButton />
      </div>
    );
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

  if (!areModelsInstalled) {
    return (
      <AddModelsControl
        showScrollDownButton={showScrollDownButton}
        onScrollDown={onScrollDown}
      />
    );
  }

  return null;
};
