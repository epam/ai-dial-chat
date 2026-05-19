import { MessageRole, type Message as MessageType } from '@epam/chat-shared';
import { ConversationInput } from '@epam/conversation-input';
import { MessageBubble } from '@epam/conversation-messages';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';

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

  const scrollToBottom = useCallback(() => {
    const target = messagesEndRef.current;
    if (!target || typeof target.scrollIntoView !== 'function') {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

  return (
    <>
      <div
        ref={messagesContainerRef}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions"
        className="relative flex w-[748px] flex-1 flex-col justify-between gap-6 overflow-y-auto px-4 py-8"
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            text={msg.content}
            className={
              msg.role === MessageRole.User ? 'justify-end' : 'justify-start'
            }
          />
        ))}
      </div>
      <div role="region" aria-label="Message input" className="w-full">
        <ConversationInput onSend={onSend} placeholder={placeholder} />
      </div>
    </>
  );
};

export default memo(ConversationView);
