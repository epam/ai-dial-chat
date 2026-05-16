import { ConversationInput } from '@epam/conversation-input';
import { MessageBubble } from '@epam/conversation-messages';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import { Message as MessageType } from '../../types';

/**
 * Props for the ConversationView component
 */
interface Props {
  /** Array of messages to display */
  messages: MessageType[];
  /** Callback when user sends a message */
  onSend: (message: string) => void;
  /** Placeholder text for the input field */
  placeholder: string;
  /** Whether the assistant is currently typing */
  isAssistantTyping?: boolean;
}

/**
 * ConversationView component that displays the message list and input.
 * Handles auto-scrolling to bottom, scroll-to-bottom button visibility,
 * and typing indicator for assistant responses.
 */
const ConversationView: FC<Props> = ({
  messages,
  onSend,
  placeholder,
  isAssistantTyping = false,
}) => {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle scroll detection to show/hide scroll button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <div
        ref={messagesContainerRef}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions"
        className="relative flex flex-1 flex-col justify-between gap-6 overflow-y-auto px-4 py-8"
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} text={msg.content} />
        ))}

        {isAssistantTyping && (
          <div
            className="mx-auto flex w-full max-w-3xl bg-[#f7f7f8] p-4 dark:bg-[#2f2f2f]"
            role="status"
            aria-live="polite"
            aria-label="Assistant is typing"
          >
            <div className="flex items-center gap-1 leading-7 text-[#202123] dark:text-[#ececf1]">
              <span className="animate-bounce">.</span>
              <span
                className="animate-bounce"
                style={{ animationDelay: '0.1s' }}
              >
                .
              </span>
              <span
                className="animate-bounce"
                style={{ animationDelay: '0.2s' }}
              >
                .
              </span>
            </div>
          </div>
        )}
        {/* Invisible element at the end for auto-scroll */}
        <div ref={messagesEndRef} />
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="bg-white hover:bg-gray-100 absolute bottom-4 right-4 flex size-10 items-center justify-center rounded-full shadow-lg transition-opacity dark:bg-[#2f2f2f] dark:hover:bg-[#3f3f3f]"
            aria-label="Scroll to bottom of conversation"
          >
            <svg
              className="text-gray-700 dark:text-gray-300 size-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        )}
      </div>
      <div role="region" aria-label="Message input">
        <ConversationInput onSend={onSend} placeholder={placeholder} />
      </div>
    </>
  );
};

export default memo(ConversationView);
