import {
  MessageRole,
  type Attachment,
  type Message as MessageType,
} from '@epam/ai-dial-chat-shared';
import { MessageBubble } from '@epam/ai-dial-conversation-messages';
import { StagesPanel } from '@epam/ai-dial-conversation-stages';
import { DialFabButton } from '@epam/ai-dial-ui-kit';
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
import { useTranslation } from 'react-i18next';
import {
  ActionsI18nKeys,
  StagesI18nKeys,
} from '../../constants/translation-keys.js';
import {
  isMessageStreaming,
  messageHasStages,
} from '../../utils/message-utils.js';
import { buildMessageActions } from './buildMessageActions.js';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

interface Props {
  messages: MessageType[];
  onSend: (message: string) => void;
  onStop?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
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
  onAttachmentsChange,
  placeholder,
  isAssistantTyping = false,
}) => {
  const { t } = useTranslation();
  const tooltips = {
    edit: t(ActionsI18nKeys.Edit),
    delete: t(ActionsI18nKeys.Delete),
    regenerate: t(ActionsI18nKeys.Regenerate),
    copy: t(ActionsI18nKeys.Copy),
    copied: t(ActionsI18nKeys.Copied),
    copyMarkdown: t(ActionsI18nKeys.Copy),
    copiedMarkdown: t(ActionsI18nKeys.Copied),
    like: t(ActionsI18nKeys.Like),
    dislike: t(ActionsI18nKeys.Dislike),
  };

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
          className="flex flex-1 flex-col overflow-y-auto px-4 py-8"
        >
          <div className="flex flex-1 flex-col gap-6">
            {messages.map((msg, index) => {
              const isStreaming = isMessageStreaming(
                msg,
                index,
                messages.length,
                isAssistantTyping,
              );
              const hasStages = messageHasStages(msg);
              return (
                <div key={msg.id} className="flex flex-col gap-2">
                  <MessageBubble
                    role={msg.role}
                    text={msg.content}
                    alwaysVisibleActions={!isStreaming}
                    actions={buildMessageActions(
                      msg,
                      {
                        onDelete: onDeleteMessage,
                        onRegenerate: onRegenerateMessage,
                      },
                      tooltips,
                    )}
                    className={
                      msg.role === MessageRole.User
                        ? 'justify-end'
                        : 'justify-start'
                    }
                  />
                  {hasStages && (
                    <StagesPanel
                      stages={msg.stages ?? []}
                      isStreaming={isStreaming}
                      headerLabel={t(StagesI18nKeys.PanelHeader)}
                      toggleAriaLabel={t(StagesI18nKeys.CollapseAriaLabel)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div ref={endRef} />
        </div>

        {showScrollButton && (
          <DialFabButton
            aria-label="Scroll to bottom"
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
            onAttachmentsChange={onAttachmentsChange}
            placeholder={placeholder}
          />
        </Suspense>
      </div>
    </>
  );
};

export default memo(ConversationView);
