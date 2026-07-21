import {
  DisplayAttachment,
  isStatusMessage,
  MessageRole,
  StatusEvent,
  type Attachment,
  type Conversation,
  type MessageRating,
  type Message as MessageType,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import { FileDndOverlay } from '@epam/ai-dial-conversation-input';
import type {
  MessageActionAriaLabels,
  MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { NeutralButton } from '@epam/ai-dial-kit';
import {
  DialFabButton,
  DialNotification,
  NotificationVariant,
  DIAL_ICON_SIZE,
} from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import {
  FC,
  lazy,
  memo,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_SELECTABLE_FILE_SIZE_BYTES } from '../../constants/files';
import { CONVERSATION_VIEW_INPUT_STYLES } from '../../constants/input-styles';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationI18nKeys,
  ConversationPanelI18nKeys,
  DialFileManagerI18nKeys,
  FileDndI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useAttachmentValidation } from '../../hooks/attachment/useAttachmentValidation';
import { useOpenAttachmentCanvas } from '../../hooks/attachment/useOpenAttachmentCanvas';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useChatSettingsFormConfig } from '../../hooks/conversation/useChatSettingsFormConfig';
import { useConversationScroll } from '../../hooks/conversation/useConversationScroll';
import { useModelSelectorLabels } from '../../hooks/conversation/useModelSelectorLabels';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { usePageFileDrag } from '../../hooks/usePageFileDrag';
import {
  dialFilesToAttachments,
  dialFolderPathToAttachment,
} from '../../utils/dial-file-to-attachment';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { isMessageChanged } from '../../utils/message-utils';
import { useDeploymentSelectorOverlay } from '../DeploymentSelector/useDeploymentSelectorOverlay';
import type { AttachResult } from '../DialFileManagerModal/types/attach-result';
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
  canStopAssistant?: boolean;
  initialModelId: string;
  streamErrorText: string;
  stoppedGeneratingText: string;
  isReadOnly?: boolean;
  onDuplicateConversation?: () => void;
  duplicateError?: string;
  isTranscriptionSupported?: boolean;
  onUploadAudio?: (file: File, contentType: string) => Promise<string>;
  onTranscribeAudio?: (audioUrl: string) => Promise<string>;
  conversation: Conversation;
  onConversationChange: (conv: Conversation) => void;
  /**
   * When provided, the model selector shows this model only and renders
   * disabled (dimmed, does not open) instead of allowing a different model
   * to be picked. The chip stays visible — it is not hidden.
   */
  fixedModel?: { id: string; displayName?: string; iconUrl?: string };
}

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
  canStopAssistant = false,
  initialModelId,
  streamErrorText,
  stoppedGeneratingText,
  isReadOnly = false,
  onDuplicateConversation,
  duplicateError,
  isTranscriptionSupported = false,
  onUploadAudio,
  onTranscribeAudio,
  conversation,
  onConversationChange,
  fixedModel,
}) => {
  const isModelFixed = !!fixedModel;
  const { renderOverlay, catalogModal } = useDeploymentSelectorOverlay();
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const isMobile = useIsMobile();
  const { preference: sendOnEnter } = useKeyboardShortcutPreference();
  const { user } = useUser();
  // bucket is the authenticated user's DIAL Core storage bucket from their profile
  const bucket = user?.bucket ?? '';
  const [isDialFileManagerOpen, setIsDialFileManagerOpen] = useState(false);
  const [pendingDialAttachments, setPendingDialAttachments] = useState<
    Attachment[]
  >([]);
  const [attachmentsAmount, setAttachmentsAmount] = useState(0);
  const { openAttachmentCanvas } = useOpenAttachmentCanvas();
  const isEditActive = !!editingMessageIndexes?.size;
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();
  const activeDeploymentId = fixedModel?.id ?? selectedItemId;

  const selectedDeployment = useMemo(
    () => items.find((item) => item.id === activeDeploymentId),
    [items, activeDeploymentId],
  );

  const {
    inputAttachmentTypes,
    isAttachmentsAllowed,
    validateAttachment,
    fileAccept,
  } = useAttachmentValidation(selectedDeployment);

  const { isDragging, pendingFiles, onFilesConsumed } = usePageFileDrag(
    isAttachmentsAllowed,
    !isDialFileManagerOpen,
  );

  const deploymentItems = useMemo(
    () =>
      items.map(
        ({
          id,
          displayName,
          iconUrl,
          type,
          inputAttachmentTypes,
          features,
        }) => ({
          id,
          displayName,
          iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
          type,
          inputAttachmentTypes,
          features,
        }),
      ),
    [items],
  );

  const fixedDeploymentItems = useMemo(
    () =>
      fixedModel
        ? [
            {
              id: fixedModel.id,
              displayName: fixedModel.displayName,
              iconUrl: fixedModel.iconUrl,
            },
          ]
        : undefined,
    [fixedModel],
  );

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

  /*
   * For each message, resolve the deployment active at that point in the conversation.
   * Scans status messages in order so messages before a model change get the initial model icon.
   */
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

  const modelSelectorLabels = useModelSelectorLabels({
    isLoading,
    error,
    itemCount: items.length,
  });

  const formatStatusModelChangedBody = useCallback(
    (from: string, to: string) =>
      t(ConversationI18nKeys.StatusModelChangedBody, {
        from,
        to,
      }),
    [t],
  );

  const {
    containerRef,
    contentRef,
    spacerRef,
    setMessageRef,
    isScrollButtonVisible,
    scrollToBottom,
    armAnchor,
  } = useConversationScroll({
    messages,
    isAssistantTyping,
    conversationId: conversation.id,
  });

  const handleSendWithAnchor = useCallback(
    async (message: string, attachments: Attachment[]) => {
      armAnchor(messages.length);
      // ConversationInput awaits this to know whether to restore the draft
      // on failure — forward onSend's result rather than discarding it.
      await onSend(message, attachments);
    },
    [onSend, messages.length, armAnchor],
  );

  const handleRegenerateMessageWithAnchor = useCallback(
    (messageIndex: number) => {
      /*
       * Regenerating while another generation is in flight is a no-op in
       * handleRegenerateMessage — skip arming the anchor so a later,
       * unrelated message update doesn't consume a stale index.
       */
      if (!isAssistantTyping) {
        armAnchor(messageIndex - 1);
      }
      onRegenerateMessage?.(messageIndex);
    },
    [isAssistantTyping, onRegenerateMessage, armAnchor],
  );

  const handleEditMessageWithAnchor = useCallback(
    (
      messageIndex: number,
      text: string,
      keptAttachments: DisplayAttachment[],
      newAttachments: Attachment[],
    ) => {
      /*
       * handleEditMessage no-ops if a generation is in flight or the text is
       * unchanged (isMessageChanged mirrors that same check) — skip arming
       * in either case so a later, unrelated update can't consume a stale index.
       */
      const originalMessage = messages[messageIndex];
      if (
        !isAssistantTyping &&
        originalMessage != null &&
        isMessageChanged(originalMessage, text, keptAttachments, newAttachments)
      ) {
        armAnchor(messageIndex);
      }
      onEditMessage?.(messageIndex, text, keptAttachments, newAttachments);
    },
    [isAssistantTyping, messages, onEditMessage, armAnchor],
  );

  const chatSettings = useChatSettingsFormConfig({
    mode: 'conversation',
    conversation,
    onConversationChange,
    deploymentFeatures: selectedDeployment?.features,
  });

  const handleAttachDialFiles = useCallback(
    (result: AttachResult) => {
      const fileAttachments = dialFilesToAttachments(result.files, bucket);
      const folderAttachments = result.folderPaths.map(
        dialFolderPathToAttachment,
      );
      setPendingDialAttachments([...fileAttachments, ...folderAttachments]);
      setIsDialFileManagerOpen(false);
    },
    [bucket],
  );

  const handleAttachmentsChange = useCallback(
    (attachments: Attachment[]) => {
      setAttachmentsAmount(attachments.length);
      onAttachmentsChange?.(attachments);
    },
    [onAttachmentsChange],
  );

  const handleAttachmentsLimitExceeded = useCallback(
    (count: number, limit: number) => {
      showNotification({
        variant: NotificationVariant.Error,
        title: t(DialFileManagerI18nKeys.TooManyFilesSelected),
        message: t(DialFileManagerI18nKeys.TooManyFilesDescription, {
          count,
          limit,
        }),
      });
    },
    [showNotification, t],
  );

  const handleInputAttachmentClick = useCallback(
    (attachment: Attachment) => {
      void openAttachmentCanvas(attachment);
    },
    [openAttachmentCanvas],
  );

  const handleMessageAttachmentClick = useCallback(
    (attachment: DisplayAttachment) => {
      void openAttachmentCanvas(attachment);
    },
    [openAttachmentCanvas],
  );

  return (
    <>
      <FileDndOverlay
        isVisible={isDragging}
        isAttachmentsAllowed={isAttachmentsAllowed}
        labels={{
          title: t(
            isAttachmentsAllowed
              ? BasicI18nKeys.AttachFiles
              : FileDndI18nKeys.OverlayDeniedTitle,
          ),
          subtitle: t(
            isAttachmentsAllowed
              ? FileDndI18nKeys.OverlaySubtitle
              : FileDndI18nKeys.OverlayDeniedSubtitle,
          ),
        }}
      />
      <div className="relative flex w-full flex-1 flex-col overflow-hidden">
        <div
          ref={containerRef}
          role="log"
          aria-label={t(ChatI18nKeys.ConversationMessages)}
          aria-live="polite"
          aria-relevant="additions"
          className="flex w-full flex-1 flex-col overflow-y-auto overflow-x-hidden"
        >
          <div
            ref={contentRef}
            className="mx-auto flex w-full min-w-0 max-w-[760px] shrink-0 flex-col gap-[26px] px-6 pt-7"
          >
            {messages.map((msg, index) => {
              const isThisMessageEditing = editingMessageIndexes?.has(index);
              return (
                <div
                  key={index.toString()}
                  ref={(el) => setMessageRef(index, el)}
                >
                  <ConversationMessageItem
                    msg={msg}
                    index={index}
                    totalCount={messages.length}
                    isAssistantTyping={isAssistantTyping}
                    editingMessageIndexes={editingMessageIndexes}
                    onSelectStarter={onSelectStarter}
                    onStartEdit={isReadOnly ? undefined : onStartEdit}
                    onDeleteMessage={isReadOnly ? undefined : onDeleteMessage}
                    onRegenerateMessage={
                      isReadOnly ? undefined : handleRegenerateMessageWithAnchor
                    }
                    onRateMessage={isReadOnly ? undefined : onRateMessage}
                    onDislikeMessage={isReadOnly ? undefined : onDislikeMessage}
                    onCancelEdit={onCancelEdit}
                    onEditMessage={handleEditMessageWithAnchor}
                    onUploadAttachment={onUploadAttachment}
                    deploymentLookup={deploymentLookup}
                    effectiveDeploymentId={effectiveDeploymentIds[index]}
                    tooltips={tooltips}
                    ariaLabels={ariaLabels}
                    cancelLabel={t(ButtonsI18nKeys.Cancel)}
                    saveLabel={t(ButtonsI18nKeys.SaveAndSubmit)}
                    editMessageAriaLabel={t(ButtonsI18nKeys.EditMessage)}
                    quickReplyButtonsAriaLabel={t(
                      ChatI18nKeys.QuickReplyButtons,
                    )}
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
                    stoppedGeneratingText={stoppedGeneratingText}
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
                    validateAttachment={
                      selectedDeployment != null
                        ? validateAttachment
                        : undefined
                    }
                    maximumAttachmentsAmount={
                      selectedDeployment?.maxInputAttachments
                    }
                    onAttachmentsLimitExceeded={handleAttachmentsLimitExceeded}
                    hideAttachFile={!isAttachmentsAllowed}
                    fileAccept={fileAccept}
                    onAttachmentClick={handleMessageAttachmentClick}
                  />
                </div>
              );
            })}
          </div>
          <div
            ref={spacerRef}
            aria-hidden="true"
            className="shrink-0"
            style={{ height: 0 }}
          />
        </div>

        {isScrollButtonVisible && (
          <DialFabButton
            aria-label={t(ChatI18nKeys.ScrollToBottom)}
            onClick={scrollToBottom}
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
          />
        )}
      </div>

      <div
        role="region"
        aria-label={t(ChatI18nKeys.MessageInput)}
        className="relative z-10 w-full px-6 pb-4"
      >
        {isReadOnly ? (
          <div className="flex flex-col items-center justify-center gap-2 p-4">
            {duplicateError && (
              <DialNotification
                variant={NotificationVariant.Error}
                message={duplicateError}
              />
            )}
            <NeutralButton
              label={t(ConversationPanelI18nKeys.DuplicateReadOnlyDescription)}
              iconBefore={<IconCopy size={DIAL_ICON_SIZE.MD} />}
              onClick={onDuplicateConversation}
            />
          </div>
        ) : (
          <>
            <Suspense fallback={null}>
              <ConversationInput
                styles={CONVERSATION_VIEW_INPUT_STYLES}
                onSend={handleSendWithAnchor}
                onUploadAttachment={onUploadAttachment}
                onStop={canStopAssistant ? onStop : undefined}
                isStreaming={isAssistantTyping}
                onAttachmentsChange={handleAttachmentsChange}
                placeholder={placeholder}
                deployments={
                  fixedModel ? fixedDeploymentItems : deploymentItems
                }
                selectedDeploymentId={
                  fixedModel ? fixedModel.id : selectedItemId
                }
                onDeploymentChange={fixedModel ? undefined : setSelectedItemId}
                isModelSelectorDisabled={isModelFixed}
                isInputDisabled={isInputDisabled}
                modelSelectorLabels={modelSelectorLabels}
                addMenuTitle={t(ConversationI18nKeys.AddMenuTitle)}
                sendLabel={t(ChatI18nKeys.SendMessage)}
                sendTitle={t(ChatI18nKeys.SendMessage)}
                stopLabel={t(ChatI18nKeys.StopStreaming)}
                isTranscriptionSupported={isTranscriptionSupported}
                messageHistory={messageHistory}
                onUploadAudio={onUploadAudio}
                onTranscribeAudio={onTranscribeAudio}
                sendOnEnter={sendOnEnter}
                chatSettings={chatSettings}
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
                onDialFileSystemClick={
                  isAttachmentsAllowed
                    ? () => setIsDialFileManagerOpen(true)
                    : undefined
                }
                dialFileSystemLabel={t(
                  ConversationI18nKeys.AttachMenuDialFileSystem,
                )}
                validateAttachment={
                  selectedDeployment != null ? validateAttachment : undefined
                }
                maximumAttachmentsAmount={
                  selectedDeployment?.maxInputAttachments
                }
                onAttachmentsLimitExceeded={handleAttachmentsLimitExceeded}
                hideAttachFile={!isAttachmentsAllowed}
                fileAccept={fileAccept}
                onAttachmentClick={handleInputAttachmentClick}
                modelPickerOverlay={isModelFixed ? undefined : renderOverlay}
              />
            </Suspense>
            <Suspense fallback={null}>
              {isDialFileManagerOpen && (
                <DialFileManagerModal
                  isOpen={isDialFileManagerOpen}
                  onClose={() => setIsDialFileManagerOpen(false)}
                  onAttach={handleAttachDialFiles}
                  bucket={bucket}
                  allowedTypes={inputAttachmentTypes}
                  maxSelectableFileSize={MAX_SELECTABLE_FILE_SIZE_BYTES}
                  maximumAttachmentsAmount={
                    selectedDeployment?.maxInputAttachments
                  }
                  existingAttachmentsAmount={attachmentsAmount}
                  canAttachFolders={
                    selectedDeployment?.features?.folderAttachments
                  }
                  title={t(BasicI18nKeys.AttachFiles)}
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
                  uploadFilesLabel={t(DialFileManagerI18nKeys.Upload)}
                  newFolderLabel={t(DialFileManagerI18nKeys.NewFolder)}
                  downloadLabel={t(ButtonsI18nKeys.Download)}
                  downloadingLabel={t(DialFileManagerI18nKeys.Downloading)}
                  deleteLabel={t(ButtonsI18nKeys.Delete)}
                  deletingLabel={t(DialFileManagerI18nKeys.DeletingLabel)}
                  deleteConfirmTitle={(names) =>
                    names.length === 1
                      ? t(DialFileManagerI18nKeys.DeleteConfirmTitleSingle)
                      : t(DialFileManagerI18nKeys.DeleteConfirmTitleMultiple)
                  }
                  deleteConfirmBody={(names) => (
                    <div className="px-6 py-3 text-sm">
                      <p className="mb-3 text-secondary">
                        {names.length === 1 ? (
                          <>
                            {t(BasicI18nKeys.DeleteConfirmDescription)}{' '}
                            <span className="break-all text-primary">
                              &quot;{names[0].split('/').pop()}&quot;?
                            </span>
                          </>
                        ) : (
                          <>
                            {t(
                              DialFileManagerI18nKeys.DeleteConfirmBodyMultiple,
                            )}{' '}
                            <span className="text-primary">
                              {names.length}{' '}
                              {t(
                                DialFileManagerI18nKeys.DeleteConfirmBodyItems,
                              )}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                  deleteConfirmLabel={t(ButtonsI18nKeys.Delete)}
                  deleteCancelLabel={t(ButtonsI18nKeys.Cancel)}
                  uploadProgressTitle={t(
                    DialFileManagerI18nKeys.UploadProgressTitle,
                  )}
                  cancelLabel={t(ButtonsI18nKeys.Cancel)}
                />
              )}
            </Suspense>
          </>
        )}
      </div>
      {catalogModal}
    </>
  );
};

export default memo(ConversationView);
