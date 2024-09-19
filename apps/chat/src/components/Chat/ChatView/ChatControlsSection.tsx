import { FC, MutableRefObject, useMemo } from 'react';

import { Message } from '@/src/types/chat';

import { StoreSelectorsHook } from '@/src/store/useStoreSelectors';

import ChatExternalControls from '../ChatExternalControls';
import { ChatInput } from '../ChatInput/ChatInput';
import { PlaybackControls } from '../Playback/PlaybackControls';
import { PublicationControls } from '../Publish/PublicationChatControls';
import { StartReplayButton } from '../StartReplayButton';

interface ChatControlsSectionProps {
  useStoreSelectors: StoreSelectorsHook;
  // isExternal: boolean;
  // isReplay: boolean;
  // isReplayPaused: boolean;
  // isReplayRequiresVariables: boolean;
  // isMessageStreaming: boolean;
  // selectedConversations: Conversation[];
  isLastMessageError: boolean;
  nextMessageBoxRef: MutableRefObject<HTMLDivElement | null>;
  onChatInputResize: (inputHeight: number) => void;
  onRegenerateMessage: () => void;
  onScrollDownClick: () => void;
  onSendMessage: (message: Message) => void;
  onStopStreamMessage: () => void;
  showPlaybackControls: boolean;
  showScrollDownButton: boolean;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
}

export const ChatControlsSection: FC<ChatControlsSectionProps> = ({
  useStoreSelectors,
  isLastMessageError,
  nextMessageBoxRef,
  onChatInputResize,
  onRegenerateMessage,
  onScrollDownClick,
  onSendMessage,
  onStopStreamMessage,
  showPlaybackControls,
  showScrollDownButton,
  textareaRef,
}) => {
  const { useConversationsSelectors } = useStoreSelectors();
  const {
    areSelectedConversationsExternal: isExternal,
    isReplaySelectedConversations: isReplay,
    isReplayPaused,
    isReplayRequiresVariables,
    isConversationsStreaming: isMessageStreaming,
    selectedConversations,
  } = useConversationsSelectors([
    'selectAreSelectedConversationsExternal',
    'selectIsReplaySelectedConversations',
    'selectIsReplayPaused',
    'selectIsReplayRequiresVariables',
    'selectIsConversationsStreaming',
    'selectSelectedConversations',
  ]);
  const isNotEmptyConversations =
    isReplayRequiresVariables ||
    selectedConversations.some((conv) => conv.messages.length > 0);
  const showChatInput = (!isReplay || isNotEmptyConversations) && !isExternal;
  const showReplayControls = useMemo<boolean>(
    () =>
      isReplay &&
      !isMessageStreaming &&
      (isReplayPaused || !!isReplayRequiresVariables),
    [isReplay, isReplayPaused, isReplayRequiresVariables, isMessageStreaming],
  );
  const showPublicationControls =
    isExternal && selectedConversations.length === 1;

  return (
    <>
      {showPublicationControls && (
        <PublicationControls
          showScrollDownButton={showScrollDownButton}
          entity={selectedConversations[0]}
          onScrollDownClick={onScrollDownClick}
          controlsClassNames="mx-2 mb-2 mt-5 w-full flex-row md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl"
        />
      )}

      {!showPlaybackControls && (
        <ChatInput
          isLastMessageError={isLastMessageError}
          isShowInput={showChatInput}
          showReplayControls={showReplayControls}
          showScrollDownButton={showScrollDownButton}
          textareaRef={textareaRef}
          onRegenerate={onRegenerateMessage}
          onResize={onChatInputResize}
          onScrollDownClick={onScrollDownClick}
          onSend={onSendMessage}
          onStopConversation={onStopStreamMessage}
        >
          {showReplayControls && !isNotEmptyConversations && (
            <StartReplayButton />
          )}
          {isExternal && (
            <ChatExternalControls
              conversations={selectedConversations}
              showScrollDownButton={showScrollDownButton}
              onScrollDownClick={onScrollDownClick}
            />
          )}
        </ChatInput>
      )}
      {showPlaybackControls && (
        <PlaybackControls
          nextMessageBoxRef={nextMessageBoxRef}
          showScrollDownButton={showScrollDownButton}
          onScrollDownClick={onScrollDownClick}
          onResize={onChatInputResize}
        />
      )}
    </>
  );
};
