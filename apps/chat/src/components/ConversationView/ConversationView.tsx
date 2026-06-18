import {
  AttachmentErrorReason,
  DisplayAttachment,
  isStatusMessage,
  MessageRole,
  StatusEvent,
  type Attachment,
  type MessageRating,
  type Message as MessageType,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import { FileDndOverlay } from '@epam/ai-dial-conversation-input';
import type {
  MessageActionAriaLabels,
  MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  DialFabButton,
  DialNeutralButton,
  DialNotification,
} from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
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
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationI18nKeys,
  ConversationPanelI18nKeys,
  DeploymentsI18nKeys,
  DialFileManagerI18nKeys,
  FileDndI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { usePageFileDrag } from '../../hooks/usePageFileDrag';
import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from '../../utils/attachment-mime';
import { dialFilesToAttachments } from '../../utils/dial-file-to-attachment';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import ConversationMessageItem from './ConversationMessageItem';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

const DialFileManagerModal = lazy(async () => {
  const module = await import('../DialFileManagerModal/DialFileManagerModal');
  return { default: module.default };
});

interface Props {
  messages: MessageType[];
  onSend: (message: string, attachments: Attachment[]) => void;
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
  onStop?: () => void;
  onDeleteMessage?: (messageIndex: number) => void;
  onRegenerateMessage?: (messageIndex: number) => void;
  onRateMessage?: (messageIndex: number, rating: MessageRating | null) => void;
  onDislikeMessage?: (messageIndex: number) => void;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onSelectStarter?: (
    starter: StarterOption,
    propertyKey?: string,
    description?: string,
  ) => void;
  onStartEdit?: (messageIndex: number) => void;
  onCancelEdit?: (messageIndex: number) => void;
  onEditMessage?: (
    messageIndex: number,
    text: string,
    keptAttachments: DisplayAttachment[],
    newAttachments: Attachment[],
  ) => void;
  editingMessageIndexes?: Set<number>;
  placeholder: string;
  isAssistantTyping?: boolean;
  initialModelId: string;
  streamErrorText: string;
  isReadOnly?: boolean;
  onDuplicateConversation?: () => void;
  duplicateError?: string;
  isTranscriptionSupported?: boolean;
  onUploadAudio?: (file: File, contentType: string) => Promise<string>;
  onTranscribeAudio?: (audioUrl: string) => Promise<string>;
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
  onDislikeMessage,
  onAttachmentsChange,
  onSelectStarter,
  onStartEdit,
  onCancelEdit,
  onEditMessage,
  editingMessageIndexes,
  placeholder,
  isAssistantTyping = false,
  initialModelId,
  streamErrorText,
  isReadOnly = false,
  onDuplicateConversation,
  duplicateError,
  isTranscriptionSupported = false,
  onUploadAudio,
  onTranscribeAudio,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { preference: sendOnEnter } = useKeyboardShortcutPreference();
  const { user } = useUser();
  // bucket is the authenticated user's DIAL Core storage bucket from their profile
  const bucket = user?.bucket ?? '';
  const [isDialFileManagerOpen, setIsDialFileManagerOpen] = useState(false);
  const [pendingDialAttachments, setPendingDialAttachments] = useState<
    Attachment[]
  >([]);
  const isEditActive = !!editingMessageIndexes?.size;
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();
  const { showNotification } = useNotification();

  const inputAttachmentTypes = useMemo(
    () =>
      items.find((item) => item.id === selectedItemId)?.inputAttachmentTypes ??
      [],
    [items, selectedItemId],
  );

  const isAttachmentsAllowed = inputAttachmentTypes.length > 0;

  const unsupportedTypeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const validateAttachment = useCallback(
    (attachment: Attachment): AttachmentErrorReason | undefined => {
      if (!isMimeTypeAllowed(attachment.contentType, inputAttachmentTypes)) {
        if (unsupportedTypeTimerRef.current != null) {
          clearTimeout(unsupportedTypeTimerRef.current);
        }
        unsupportedTypeTimerRef.current = setTimeout(() => {
          showNotification({
            variant: NotificationVariant.Error,
            title: t(AttachmentsI18nKeys.UnsupportedTypeTitle),
            message: t(AttachmentsI18nKeys.UnsupportedTypeMessage, {
              formats: mimeTypesToExtensionLabels(inputAttachmentTypes),
            }),
          });
          unsupportedTypeTimerRef.current = null;
        }, 100);
        return AttachmentErrorReason.UnsupportedType;
      }
      return undefined;
    },
    [inputAttachmentTypes, showNotification, t],
  );

  const { isDragging, pendingFiles, onFilesConsumed } =
    usePageFileDrag(isAttachmentsAllowed);

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

  const messageHistory = useMemo(
    () =>
      messages.filter((m) => m.role === MessageRole.User).map((m) => m.content),
    [messages],
  );

  const deploymentItems = useMemo(
    () =>
      items.map(({ id, displayName, iconUrl, type, inputAttachmentTypes }) => ({
        id,
        displayName,
        iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
        type,
        inputAttachmentTypes,
      })),
    [items],
  );

  const tooltips = useMemo<MessageActionTooltips>(
    () => ({
      edit: t(ButtonsI18nKeys.Edit),
      delete: t(ButtonsI18nKeys.Delete),
      regenerate: t(ButtonsI18nKeys.Regenerate),
      copy: t(ButtonsI18nKeys.CopyText),
      copied: t(ButtonsI18nKeys.Copied),
      copyMarkdown: t(ButtonsI18nKeys.CopyAsMarkdown),
      copiedMarkdown: t(ButtonsI18nKeys.Copied),
      like: t(ButtonsI18nKeys.Like),
      dislike: t(ButtonsI18nKeys.Dislike),
    }),
    [t],
  );

  const ariaLabels = useMemo<MessageActionAriaLabels>(
    () => ({
      editMessage: t(ButtonsI18nKeys.EditMessage),
      deleteMessage: t(ButtonsI18nKeys.DeleteMessage),
      regenerateResponse: t(ButtonsI18nKeys.RegenerateResponse),
      copyResponse: t(ButtonsI18nKeys.CopyResponse),
      copyAsMarkdown: t(ButtonsI18nKeys.CopyAsMarkdown),
      likeResponse: t(ButtonsI18nKeys.LikeResponse),
      dislikeResponse: t(ButtonsI18nKeys.DislikeResponse),
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
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
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

  const handleAttachDialFiles = useCallback(
    (files: Parameters<typeof dialFilesToAttachments>[0]) => {
      setPendingDialAttachments(dialFilesToAttachments(files, bucket));
      setIsDialFileManagerOpen(false);
    },
    [bucket],
  );

  return (
    <>
      <FileDndOverlay
        isVisible={isDragging}
        isAttachmentsAllowed={isAttachmentsAllowed}
        title={t(
          isAttachmentsAllowed
            ? FileDndI18nKeys.OverlayTitle
            : FileDndI18nKeys.OverlayDeniedTitle,
        )}
        subtitle={t(
          isAttachmentsAllowed
            ? FileDndI18nKeys.OverlaySubtitle
            : FileDndI18nKeys.OverlayDeniedSubtitle,
        )}
      />
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
              const isThisMessageEditing = editingMessageIndexes?.has(index);
              return (
                <ConversationMessageItem
                  key={index.toString()}
                  msg={msg}
                  index={index}
                  totalCount={messages.length}
                  isAssistantTyping={isAssistantTyping}
                  editingMessageIndexes={editingMessageIndexes}
                  onSelectStarter={onSelectStarter}
                  onStartEdit={onStartEdit}
                  onDeleteMessage={onDeleteMessage}
                  onRegenerateMessage={onRegenerateMessage}
                  onRateMessage={onRateMessage}
                  onDislikeMessage={onDislikeMessage}
                  onCancelEdit={onCancelEdit}
                  onEditMessage={onEditMessage}
                  onUploadAttachment={onUploadAttachment}
                  deploymentLookup={deploymentLookup}
                  effectiveDeploymentId={effectiveDeploymentIds[index]}
                  tooltips={tooltips}
                  ariaLabels={ariaLabels}
                  cancelLabel={t(ButtonsI18nKeys.Cancel)}
                  saveLabel={t(ButtonsI18nKeys.SaveAndSubmit)}
                  editMessageAriaLabel={t(ButtonsI18nKeys.EditMessage)}
                  quickReplyButtonsAriaLabel={t(ChatI18nKeys.QuickReplyButtons)}
                  showMoreLabel={t(ButtonsI18nKeys.ShowMore)}
                  showLessLabel={t(ButtonsI18nKeys.ShowLess)}
                  showMoreUserMessageAriaLabel={t(
                    ChatI18nKeys.ShowMoreUserMessage,
                  )}
                  showLessUserMessageAriaLabel={t(
                    ChatI18nKeys.ShowLessUserMessage,
                  )}
                  statusModelChangedTitle={t(
                    ConversationI18nKeys.StatusModelChangedTitle,
                  )}
                  formatStatusModelChangedBody={formatStatusModelChangedBody}
                  streamErrorText={streamErrorText}
                  thinkingLabel={t(ChatI18nKeys.Thinking)}
                  executedLabel={t(ConversationI18nKeys.StagesExecuted)}
                  stepsLabel={(count) =>
                    t(ConversationI18nKeys.StagesStep, { count })
                  }
                  pendingDropFiles={
                    isEditActive && isThisMessageEditing
                      ? pendingFiles
                      : undefined
                  }
                  onDropFilesConsumed={
                    isEditActive && isThisMessageEditing
                      ? onFilesConsumed
                      : undefined
                  }
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
        {isReadOnly ? (
          <div className="flex flex-col items-center justify-center gap-2 p-4">
            {duplicateError && (
              <DialNotification
                variant={NotificationVariant.Error}
                message={duplicateError}
              />
            )}
            <DialNeutralButton
              label={t(ConversationPanelI18nKeys.DuplicateReadOnlyDescription)}
              iconBefore={<IconCopy />}
              onClick={onDuplicateConversation}
            />
          </div>
        ) : (
          <>
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
                isTranscriptionSupported={isTranscriptionSupported}
                messageHistory={messageHistory}
                onUploadAudio={onUploadAudio}
                onTranscribeAudio={onTranscribeAudio}
                sendOnEnter={sendOnEnter}
                pendingDropFiles={!isEditActive ? pendingFiles : undefined}
                pendingAttachments={
                  !isEditActive ? pendingDialAttachments : undefined
                }
                onDropFilesConsumed={
                  !isEditActive ? onFilesConsumed : undefined
                }
                onPendingAttachmentsConsumed={
                  !isEditActive
                    ? () => setPendingDialAttachments([])
                    : undefined
                }
                autoFocus={!isMobile}
                onDialFileSystemClick={() => setIsDialFileManagerOpen(true)}
                dialFileSystemLabel={t(
                  ConversationI18nKeys.AttachMenuDialFileSystem,
                )}
                validateAttachment={
                  isAttachmentsAllowed ? validateAttachment : undefined
                }
              />
            </Suspense>
            <Suspense fallback={null}>
              {isDialFileManagerOpen && (
                <DialFileManagerModal
                  isOpen={isDialFileManagerOpen}
                  onClose={() => setIsDialFileManagerOpen(false)}
                  onAttach={handleAttachDialFiles}
                  bucket={bucket}
                  title={t(DialFileManagerI18nKeys.Title)}
                  attachLabel={t(DialFileManagerI18nKeys.Attach)}
                  emptyTitle={t(DialFileManagerI18nKeys.Empty)}
                  emptyDescription=""
                  errorMessage={t(DialFileManagerI18nKeys.Error)}
                  retryLabel={t(DialFileManagerI18nKeys.Retry)}
                  hiddenFilesLabel={t(DialFileManagerI18nKeys.HiddenFiles)}
                  showHiddenFilesLabel={t(
                    DialFileManagerI18nKeys.ShowHiddenFiles,
                  )}
                  hideHiddenFilesLabel={t(
                    DialFileManagerI18nKeys.HideHiddenFiles,
                  )}
                  getSelectionLabel={(count) =>
                    t(DialFileManagerI18nKeys.ItemsSelected, { count })
                  }
                />
              )}
            </Suspense>
          </>
        )}
      </div>
    </>
  );
};

export default memo(ConversationView);
