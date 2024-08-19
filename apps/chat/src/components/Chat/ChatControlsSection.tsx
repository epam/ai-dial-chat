import { FC, MutableRefObject, useMemo } from 'react';

import { Conversation, Message } from '@/src/types/chat';

import ChatExternalControls from './ChatExternalControls';
import { ChatInput } from './ChatInput/ChatInput';
import { PlaybackControls } from './Playback/PlaybackControls';
import { PublicationControls } from './Publish/PublicationChatControls';
import { StartReplayButton } from './StartReplayButton';

interface ChatControlsSectionProps {
  isExternal: boolean;
  isLastMessageError: boolean;
  isReplay: boolean;
  isReplayPaused: boolean;
  isReplayRequiresVariables: boolean;
  isMessageStreaming: boolean;
  nextMessageBoxRef: MutableRefObject<HTMLDivElement | null>;
  onChatInputResize: (inputHeight: number) => void;
  onRegenerateMessage: () => void;
  onScrollDownClick: () => void;
  onSendMessage: (message: Message) => void;
  onStopStreamMessage: () => void;
  selectedConversations: Conversation[];
  showPlaybackControls: boolean;
  showScrollDownButton: boolean;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
}

export const ChatControlsSection: FC<ChatControlsSectionProps> = ({
  isExternal,
  isLastMessageError,
  isReplay,
  isReplayPaused,
  isReplayRequiresVariables,
  isMessageStreaming,
  nextMessageBoxRef,
  onChatInputResize,
  onRegenerateMessage,
  onScrollDownClick,
  onSendMessage,
  onStopStreamMessage,
  selectedConversations,
  showPlaybackControls,
  showScrollDownButton,
  textareaRef,
}) => {
  const isNotEmptyConversations =
    isReplayRequiresVariables ||
    selectedConversations.some((conv) => conv.messages.length > 0);
  const showChatInput = (!isReplay || isNotEmptyConversations) && !isExternal;
  const showReplayControls = useMemo(
    () =>
      isReplay &&
      !isMessageStreaming &&
      (isReplayPaused || isReplayRequiresVariables),
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
