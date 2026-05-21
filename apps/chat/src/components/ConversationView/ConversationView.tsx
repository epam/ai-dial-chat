import {
  MessageRole,
  type Message as MessageType,
} from '@epam/ai-dial-chat-shared';
import { MessageBubble } from '@epam/ai-dial-conversation-messages';
import { DialRoundedButton } from '@epam/ai-dial-ui-kit';
import {
  FC,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { buildMessageActions } from './buildMessageActions.js';

const ConversationInput = lazy(() =>
  import('@epam/ai-dial-conversation-input').then((module) => ({
    default: module.ConversationInput,
  })),
);

interface Props {
  messages: MessageType[];
  onSend: (message: string) => void;
  onStop?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  placeholder: string;
  isAssistantTyping?: boolean;
}

const NEAR_BOTTOM_THRESHOLD = 80;

const ConversationView: FC<Props> = ({
  messages,
  onSend,
  onStop,
  onDeleteMessage,
  onRegenerateMessage,
  placeholder,
  isAssistantTyping = false,
}) => {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // True when the user has manually scrolled up during a stream.
  // Pauses auto-scroll until they click the scroll button or send a new message.
  const userScrolledRef = useRef(false);

  // Prevents the scroll handler from misreading programmatic scrolls as user input.
  const isProgrammaticRef = useRef(false);

  const scrollToBottom = useCallback((instant = false) => {
    const container = containerRef.current;
    if (!container) return;
    isProgrammaticRef.current = true;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: instant ? 'instant' : 'smooth',
    });
    // Reset flag after the scroll event has fired
    requestAnimationFrame(() => {
      isProgrammaticRef.current = false;
    });
  }, []);

  // When streaming ends, release user override so the next send auto-scrolls.
  useEffect(() => {
    if (!isAssistantTyping) {
      userScrolledRef.current = false;
    }
  }, [isAssistantTyping]);

  // Scroll on message updates.
  // During streaming: instant + skip if user scrolled up.
  // On new turns (non-streaming message count change): always smooth-scroll.
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    const lengthChanged = messages.length !== prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (isAssistantTyping) {
      // Token arrived — scroll only if user hasn't overridden
      if (!userScrolledRef.current) {
        scrollToBottom(true);
      }
    } else if (lengthChanged) {
      // New user message appended (or conversation loaded) — always scroll
      userScrolledRef.current = false;
      scrollToBottom(false);
    }
  }, [messages, isAssistantTyping, scrollToBottom]);

  // Scroll listener: detect user scrolling up during stream
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;

      setShowScrollButton(!isNearBottom);

      if (isProgrammaticRef.current) return;

      if (isAssistantTyping && !isNearBottom) {
        userScrolledRef.current = true;
      } else if (isNearBottom) {
        userScrolledRef.current = false;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAssistantTyping]);

  const handleScrollToBottom = useCallback(() => {
    userScrolledRef.current = false;
    scrollToBottom(false);
  }, [scrollToBottom]);

  return (
    <>
      <div className="relative flex w-[748px] flex-1 flex-col overflow-hidden">
        <div
          ref={containerRef}
          role="log"
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions"
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-8"
        >
          {messages.map((msg, index) => {
            const isStreaming =
              isAssistantTyping &&
              index === messages.length - 1 &&
              msg.role === MessageRole.Assistant;
            return (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                text={msg.content}
                alwaysVisibleActions={!isStreaming}
                actions={buildMessageActions(msg, {
                  onDelete: onDeleteMessage,
                  onRegenerate: onRegenerateMessage,
                })}
                className={
                  msg.role === MessageRole.User
                    ? 'justify-end'
                    : 'justify-start'
                }
              />
            );
          })}
          <div ref={endRef} />
        </div>

        {showScrollButton && (
          <DialRoundedButton
            aria-label="Scroll to bottom"
            label="Scroll to bottom"
            onClick={handleScrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          />
        )}
      </div>

      <div role="region" aria-label="Message input" className="w-full">
        <Suspense fallback={null}>
          <ConversationInput
            onSend={onSend}
            onStop={onStop}
            isStreaming={isAssistantTyping}
            placeholder={placeholder}
          />
        </Suspense>
      </div>
    </>
  );
};

export default memo(ConversationView);
