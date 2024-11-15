import { MutableRefObject, ReactNode, useEffect, useRef } from 'react';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ChatInputFooter } from './ChatInputFooter';
import { ChatInputMessage } from './ChatInputMessage';

import { Message } from '@epam/ai-dial-shared';

interface Props {
  onSend: (message: Message) => void;
  onScrollDownClick: () => void;
  onStopConversation: () => void;
  onResize: (height: number) => void;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  isShowInput: boolean;
  isLastMessageError: boolean;
  onRegenerate: () => void;
  showReplayControls: boolean;
  children?: ReactNode;
}

export const ChatInput = ({
  onSend,
  onRegenerate,
  isLastMessageError,
  onScrollDownClick,
  onStopConversation,
  onResize,
  textareaRef,
  showScrollDownButton,
  isShowInput,
  showReplayControls,
  children,
}: Props) => {
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const inputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inputRef) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      inputRef.current?.clientHeight && onResize(inputRef.current.clientHeight);
    });
    inputRef.current && resizeObserver.observe(inputRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [inputRef, onResize]);

  return (
    <div ref={inputRef} className="w-full pt-3 md:pt-5">
      <div className="relative">{!messageIsStreaming && children}</div>
      {isShowInput && (
        <ChatInputMessage
          isLastMessageError={isLastMessageError}
          onRegenerate={onRegenerate}
          textareaRef={textareaRef}
          showScrollDownButton={showScrollDownButton}
          onScrollDownClick={onScrollDownClick}
          onSend={onSend}
          onStopConversation={onStopConversation}
          showReplayControls={showReplayControls}
        />
      )}
      <ChatInputFooter />
    </div>
  );
};
