import classNames from 'classnames';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { SchemaCompareWarning } from '@/src/components/Chat/ChatInput/SchemaCompareWarning';
import { StartReplayButton } from '@/src/components/Chat/StartReplayButton';

import { AddModelsControl } from './AddModelsControl';
import { ChatExternalControls } from './ChatExternalControls';

interface Props {
  isNotEmptyConversations: boolean;
  showReplayControls: boolean;
  isChatReadyForInput: boolean;
  isConversationWithSchema: boolean;
  showScrollDownButton: boolean;
  isWideLayout?: boolean;
  onScrollDown: () => void;
}

export const ChatInputControls = ({
  isNotEmptyConversations,
  showReplayControls,
  isChatReadyForInput,
  isConversationWithSchema,
  showScrollDownButton,
  isWideLayout,
  onScrollDown,
}: Props) => {
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const isReadOnly = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsReadOnly,
  );

  const isPublic =
    selectedConversations.length && isEntityIdPublic(selectedConversations[0]);

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

  if (isReadOnly || isPublic) {
    return (
      <ChatExternalControls
        conversations={selectedConversations}
        showScrollDownButton={showScrollDownButton}
        onScrollDownClick={onScrollDown}
      />
    );
  }

  if (!isChatReadyForInput) {
    return (
      <AddModelsControl
        showScrollDownButton={showScrollDownButton}
        onScrollDown={onScrollDown}
      />
    );
  }

  return null;
};
