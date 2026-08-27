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
  isSomeConversationWithSchema: boolean;
  showScrollDownButton: boolean;
  isWideLayout?: boolean;
  onScrollDown: () => void;
}

export const ChatInputControls = ({
  isNotEmptyConversations,
  showReplayControls,
  isChatReadyForInput,
  isSomeConversationWithSchema,
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
  const isNotAllowed = useAppSelector(
    ConversationsSelectors.selectIsNotAllowed,
  );

  const isPublic =
    selectedConversations.length > 0 &&
    isEntityIdPublic(selectedConversations[0]);

  if (isSomeConversationWithSchema && selectedConversations.length > 1) {
    return <SchemaCompareWarning />;
  }

  if (showReplayControls && !isNotEmptyConversations) {
    return !isReadOnly ? (
      <div className={classNames({ 'mt-10': isWideLayout })}>
        <StartReplayButton />
      </div>
    ) : null;
  }

  const shouldShowExternalControls = isPublic || isReadOnly;
  const shouldShowModelsControl =
    !isChatReadyForInput && !isReadOnly && !isNotAllowed;

  if (!shouldShowExternalControls && !shouldShowModelsControl) {
    return null;
  }

  return (
    <>
      {shouldShowExternalControls && (
        <ChatExternalControls
          conversations={selectedConversations}
          showScrollDownButton={showScrollDownButton}
          onScrollDownClick={onScrollDown}
          {...(isPublic ? { isChatReadyForInput } : {})}
        />
      )}
      {shouldShowModelsControl && (
        <AddModelsControl
          showScrollDownButton={showScrollDownButton}
          onScrollDown={onScrollDown}
        />
      )}
    </>
  );
};
