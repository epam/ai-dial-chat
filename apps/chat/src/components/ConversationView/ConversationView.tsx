import {
  DisplayAttachment,
  isStatusMessage,
  StatusEvent,
  type Attachment,
  type MessageRating,
  type Message as MessageType,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import type {
  MessageActionAriaLabels,
  MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { DialFabButton } from '@epam/ai-dial-ui-kit';
import {
  FC,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionsI18nKeys,
  ChatI18nKeys,
  ConversationI18nKeys,
  DeploymentsI18nKeys,
} from '../../constants/translation-keys.js';
import { useDeployments } from '../../context/DeploymentsContext.js';
import { resolveCatalogIconUrl } from '../../utils/icon-path.js';
import ConversationMessageItem from './ConversationMessageItem.js';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

interface Props {
  messages: MessageType[];
  onSend: (message: string, attachments: Attachment[]) => void;
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
  onStop?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  onRateMessage?: (messageId: string, rating: MessageRating | null) => void;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onSelectStarter?: (
    starter: StarterOption,
    propertyKey?: string,
    description?: string,
  ) => void;
  onStartEdit?: (messageId: string) => void;
  onCancelEdit?: (messageId: string) => void;
  onEditMessage?: (
    messageId: string,
    text: string,
    keptAttachments: DisplayAttachment[],
    newAttachments: Attachment[],
  ) => void;
  editingMessageIds?: Set<string>;
  placeholder: string;
  isAssistantTyping?: boolean;
  initialModelId: string;
  streamErrorText: string;
}

const NEAR_BOTTOM_THRESHOLD = 80;

const ConversationView: FC<Props> = ({
  messages,
  onSend,
  onUploadAttachment,
  onStop,
  onDeleteMessage,
  onRegenerateMessage,
  onRateMessage,
  onAttachmentsChange,
  onSelectStarter,
  onStartEdit,
  onCancelEdit,
  onEditMessage,
  editingMessageIds,
  placeholder,
  isAssistantTyping = false,
  initialModelId,
  streamErrorText,
}) => {
  const { t } = useTranslation();
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();

  const isInputDisabled = useMemo(
    () => !!selectedDeploymentConfiguration?.isChatMessageInputDisabled,
    [selectedDeploymentConfiguration],
  );

  const deploymentLookup = useMemo<
    Record<string, { displayName: string; iconUrl: string | undefined }>
  >(
    () =>
      Object.fromEntries(
        items.map((d) => [
          d.id,
          {
            displayName: d.displayName,
            iconUrl: resolveCatalogIconUrl(d.iconUrl),
          },
        ]),
      ),
    [items],
  );

  // For each message, resolve the deployment active at that point in the conversation.
  // Scans status messages in order so messages before a model change get the initial model icon.
  const effectiveDeploymentIds = useMemo<(string | undefined)[]>(
    () =>
      messages.reduce<{
        ids: (string | undefined)[];
        activeId: string | undefined;
      }>(
        (acc, msg) => {
          const nextId =
            isStatusMessage(msg) &&
            msg.custom_content?.event_type === StatusEvent.ModelChanged
              ? msg.custom_content.new_deployment_id
              : acc.activeId;
          return {
            ids: [...acc.ids, msg.deploymentId ?? nextId],
            activeId: nextId,
          };
        },
        { ids: [], activeId: initialModelId },
      ).ids,
    [messages, initialModelId],
  );

  const deploymentItems = useMemo(
    () =>
      items.map(({ id, displayName, iconUrl, type }) => ({
        id,
        displayName,
        iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
        type,
      })),
    [items],
  );

  const tooltips = useMemo<MessageActionTooltips>(
    () => ({
      edit: t(ActionsI18nKeys.Edit),
      delete: t(ActionsI18nKeys.Delete),
      regenerate: t(ActionsI18nKeys.Regenerate),
      copy: t(ActionsI18nKeys.Copy),
      copied: t(ActionsI18nKeys.Copied),
      copyMarkdown: t(ActionsI18nKeys.Copy),
      copiedMarkdown: t(ActionsI18nKeys.Copied),
      like: t(ActionsI18nKeys.Like),
      dislike: t(ActionsI18nKeys.Dislike),
    }),
    [t],
  );

  const ariaLabels = useMemo<MessageActionAriaLabels>(
    () => ({
      editMessage: t(ActionsI18nKeys.EditMessage),
      deleteMessage: t(ActionsI18nKeys.DeleteMessage),
      regenerateResponse: t(ActionsI18nKeys.RegenerateResponse),
      copyResponse: t(ActionsI18nKeys.CopyResponse),
      copyAsMarkdown: t(ActionsI18nKeys.CopyAsMarkdown),
      likeResponse: t(ActionsI18nKeys.LikeResponse),
      dislikeResponse: t(ActionsI18nKeys.DislikeResponse),
    }),
    [t],
  );

  const modelSelectorLabels = useMemo(
    () => ({
      ariaLabel: t(DeploymentsI18nKeys.SelectorAriaLabel),
      loading: isLoading ? t(DeploymentsI18nKeys.SelectorLoading) : undefined,
      error: error ? t(DeploymentsI18nKeys.SelectorError) : undefined,
      empty:
        !isLoading && !error && items.length === 0
          ? t(DeploymentsI18nKeys.SelectorEmpty)
          : undefined,
      searchPlaceholder: t(DeploymentsI18nKeys.SelectorSearchPlaceholder),
      closeLabel: t(DeploymentsI18nKeys.SelectorCloseLabel),
    }),
    [t, isLoading, error, items.length],
  );

  const formatStatusModelChangedBody = useCallback(
    (from: string, to: string) =>
      t(ConversationI18nKeys.StatusModelChangedBody, {
        from,
        to,
      }),
    [t],
  );

  const [isScrollButtonVisible, setIsScrollButtonVisible] = useState(false);
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

      setIsScrollButtonVisible(!isNearBottom);

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
      <div className="relative flex w-full flex-1 flex-col overflow-hidden">
        <div
          ref={containerRef}
          role="log"
          aria-label={t(ChatI18nKeys.ConversationMessages)}
          aria-live="polite"
          aria-relevant="additions"
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-[748px] flex-1 flex-col gap-6 px-4 pt-2">
            {messages.map((msg, index) => {
              return (
                <ConversationMessageItem
                  key={msg.id}
                  msg={msg}
                  index={index}
                  totalCount={messages.length}
                  isAssistantTyping={isAssistantTyping}
                  editingMessageIds={editingMessageIds}
                  onSelectStarter={onSelectStarter}
                  onStartEdit={onStartEdit}
                  onDeleteMessage={onDeleteMessage}
                  onRegenerateMessage={onRegenerateMessage}
                  onRateMessage={onRateMessage}
                  onCancelEdit={onCancelEdit}
                  onEditMessage={onEditMessage}
                  onUploadAttachment={onUploadAttachment}
                  deploymentLookup={deploymentLookup}
                  effectiveDeploymentId={effectiveDeploymentIds[index]}
                  tooltips={tooltips}
                  ariaLabels={ariaLabels}
                  cancelLabel={t(ActionsI18nKeys.Cancel)}
                  saveLabel={t(ActionsI18nKeys.SaveAndSubmit)}
                  editMessageAriaLabel={t(ActionsI18nKeys.EditMessage)}
                  quickReplyButtonsAriaLabel={t(ChatI18nKeys.QuickReplyButtons)}
                  statusModelChangedTitle={t(
                    ConversationI18nKeys.StatusModelChangedTitle,
                  )}
                  formatStatusModelChangedBody={formatStatusModelChangedBody}
                  streamErrorText={streamErrorText}
                />
              );
            })}
          </div>
          <div ref={endRef} />
        </div>

        {isScrollButtonVisible && (
          <DialFabButton
            aria-label={t(ChatI18nKeys.ScrollToBottom)}
            onClick={handleScrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2"
          />
        )}
      </div>

      <div
        role="region"
        aria-label={t(ChatI18nKeys.MessageInput)}
        className="w-full"
      >
        <Suspense fallback={null}>
          <ConversationInput
            onSend={onSend}
            onUploadAttachment={onUploadAttachment}
            onStop={onStop}
            isStreaming={isAssistantTyping}
            onAttachmentsChange={onAttachmentsChange}
            placeholder={placeholder}
            deployments={deploymentItems}
            selectedDeploymentId={selectedItemId}
            onDeploymentChange={setSelectedItemId}
            isInputDisabled={isInputDisabled}
            modelSelectorLabels={modelSelectorLabels}
            sendLabel={t(ChatI18nKeys.SendMessage)}
            stopLabel={t(ChatI18nKeys.StopStreaming)}
          />
        </Suspense>
      </div>
    </>
  );
};

export default memo(ConversationView);
