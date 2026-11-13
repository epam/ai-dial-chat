import {
  useLatestCanvasRequest,
  useAttachmentCanvas,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  FileDndOverlay,
  isMimeTypeAllowed,
} from '@epam/ai-dial-attachment-input';
import {
  type AttachmentValidationErrorEvent,
  getEffectiveDeploymentIds,
  isQuickAppSchema,
  normalizeResponseFormat,
  referenceAttachmentToPdfCanvasContent,
  useAttachmentValidation,
  useChatSettingsFormConfig,
  useConversationAnnotationPool,
} from '@epam/ai-dial-chat-hooks';
import { useMessageSelectionReply } from '@epam/ai-dial-chat-hooks/conversation';
import { useConversationScroll } from '@epam/ai-dial-chat-hooks/scroll-anchoring';
import { usePageFileDrag } from '@epam/ai-dial-chat-hooks/viewport-layout';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  type Annotation,
  type Attachment,
  type Conversation,
  DisplayAttachment,
  mergeClasses,
  type Message as MessageType,
  type MessageRating,
  type RequestSkill,
  type StarterOption,
  type ToolMenuItem,
  type UploadedAttachmentResult,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  type TextInsertion,
  type ToolsChipLabels,
} from '@epam/ai-dial-conversation-input';
import { MessageSelectionReply } from '@epam/ai-dial-conversation-messages';
import {
  BASE_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  FabButton,
  LiveRegion,
  LiveRegionElement,
} from '@epam/ai-dial-ui-kit';
import { IconPrompt } from '@tabler/icons-react';
import {
  FC,
  lazy,
  memo,
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentCanvasI18nKeys,
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationI18nKeys,
  DialFileManagerI18nKeys,
  FileDndI18nKeys,
  PromptSelectorI18nKeys,
  VoiceRecordingI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useNotification } from '../../context/NotificationContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { useAnchoredMessageActions } from '../../hooks/conversation/useAnchoredMessageActions';
import { useChatSettingsFormLabels } from '../../hooks/conversation/useChatSettingsFormLabels';
import { useComposerDraftWiring } from '../../hooks/conversation/useComposerDraftWiring';
import { useConversationDeploymentState } from '../../hooks/conversation/useConversationDeploymentState';
import { useConversationMcpApps } from '../../hooks/conversation/useConversationMcpApps';
import { useMessageListLabels } from '../../hooks/conversation/useMessageListLabels';
import { useDialFileManagerState } from '../../hooks/files/useDialFileManagerState';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { useUiFeature } from '../../hooks/useUiFeature';
import { attachmentCanvasUrlResolvers } from '../../utils/attachment-display-resolvers';
import { buildAttachmentValidationNotification } from '../../utils/attachment-validation-notification';
import { useDeploymentSelectorOverlay } from '../DeploymentSelector/useDeploymentSelectorOverlay';
import FooterMessage from '../FooterMessage/FooterMessage';
import { usePromptSelectorOverlay } from '../PromptSelector/usePromptSelectorOverlay';
import { useSkillSelectorOverlay } from '../SkillSelector/useSkillSelectorOverlay';
import UsageLimitBanner from '../UsageLimitBanner/UsageLimitBanner';
import UsageLimitsControl from '../UsageLimitsControl/UsageLimitsControl';
import ConversationFileManagerModal from './ConversationFileManagerModal';
import ConversationMessageItem from './ConversationMessageItem';
import ConversationReadOnlyFooter from './ConversationReadOnlyFooter';
import { ConversationReloadNotification } from './ConversationReloadNotification';
import { getInputMessageHistory } from './utils/message-display';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

interface Props {
  messages: MessageType[];
  onSend: (
    message: string,
    attachments: Attachment[],
    skills?: RequestSkill[],
  ) => void;
  onUploadAttachment?: (
    attachment: Attachment,
  ) => Promise<UploadedAttachmentResult>;
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
  /** Sends a visualizer `SEND_MESSAGE` text; `undefined` while visualizer messages are disabled. */
  onVisualizerSendMessage?: (content: string) => void;
  onStartEdit?: (messageIndex: number) => void;
  onCancelEdit?: (messageIndex: number) => void;
  onEditMessage?: (
    messageIndex: number,
    text: string,
    keptAttachments: DisplayAttachment[],
    newAttachments: Attachment[],
    skills?: RequestSkill[],
  ) => void;
  editingMessageIndexes?: Set<number>;
  placeholder: string;
  isAssistantTyping?: boolean;
  canStopAssistant?: boolean;
  initialModelId: string;
  stoppedGeneratingText: string;
  isReadOnly?: boolean;
  onDuplicateConversation?: () => void;
  /** The conversation's model is hidden, so a read-only chat explains why it can't be duplicated instead of offering the button. */
  isDuplicateUnavailable?: boolean;
  duplicateError?: string;
  isAudioMessageSupported?: boolean;
  isVoiceRecordingSupported?: boolean;
  onTranscribeAudio?: (file: File, signal: AbortSignal) => Promise<string>;
  conversation: Conversation;
  onConversationChange: (conv: Conversation) => void;
  /**
   * Externally-driven text to seed into the message input (e.g. overlay
   * mode's `setInputContent`). Applies once on content/revision change; the
   * user's own typing after that is not overridden until this changes again.
   */
  inputContent?: string;
  /**
   * Token that forces `inputContent` to re-apply even if its string is
   * unchanged. `0` (or omitted) means no content is pending: a revision > 0 at
   * mount is treated as fresh content for the conversation, so the host resets
   * it to `0` once the content has been shown.
   */
  inputContentRevision?: number;
  /**
   * Text inserted at the composer's caret whenever its `revision` changes. This
   * is the channel `onInsertText` feeds: unlike `inputContent` it keeps whatever
   * the user has already typed, and it is undoable.
   */
  inputInsertion?: TextInsertion;
  /**
   * Called with resolved text (e.g. a picked prompt, params substituted) that
   * should be inserted into the composer via the `inputInsertion` channel.
   * Required for the Prompts picker to work.
   */
  onInsertText?: (text: string) => void;
  /**
   * When provided, the model selector shows this model only and renders
   * disabled (dimmed, does not open) instead of allowing a different model
   * to be picked. The chip stays visible — it is not hidden.
   */
  fixedModel?: { id: string; displayName?: string; iconUrl?: string };
  toolsMenuItems?: ToolMenuItem[];
  onToolToggle?: (toolId: string) => void;
  toolsMenuTitle?: string;
  toolsChipLabels?: ToolsChipLabels;
  /**
   * Neutral content rendered inside the scrollable message container, above
   * the message list (e.g. the scheduled-task conversation summary banner).
   * Never persisted as a message.
   */
  topContent?: ReactNode;
  /**
   * Shows each message's relative send time in its action row, revealed on
   * hover or focus (always on devices without hover). Off by default so hosts
   * such as the app preview chat stay unchanged.
   */
  hasMessageTimestamps?: boolean;
  /** A terminal read failed; received output remains in the view. */
  hasConversationReloadError?: boolean;
  /** Disables read retry while its request is pending. */
  isReloadingConversation?: boolean;
  /** Repeats the terminal read without regenerating or saving. */
  onRetryConversationReload?: () => Promise<void>;
}

export type ConversationViewProps = Props;

const ConversationView: FC<Props> = ({
  messages,
  hasConversationReloadError = false,
  isReloadingConversation = false,
  onRetryConversationReload,
  onSend,
  onUploadAttachment,
  onStop,
  onDeleteMessage,
  onRegenerateMessage,
  onRateMessage,
  onDislikeMessage,
  onAttachmentsChange,
  onSelectStarter,
  onVisualizerSendMessage,
  onStartEdit,
  onCancelEdit,
  onEditMessage,
  editingMessageIndexes,
  placeholder,
  isAssistantTyping = false,
  canStopAssistant = false,
  initialModelId,
  stoppedGeneratingText,
  isReadOnly = false,
  onDuplicateConversation,
  isDuplicateUnavailable = false,
  duplicateError,
  isAudioMessageSupported = false,
  isVoiceRecordingSupported = false,
  onTranscribeAudio,
  conversation,
  onConversationChange,
  fixedModel,
  inputContent,
  inputContentRevision,
  inputInsertion,
  onInsertText,
  toolsMenuItems,
  onToolToggle,
  toolsMenuTitle,
  toolsChipLabels,
  topContent,
  hasMessageTimestamps = false,
}) => {
  const isModelFixed = !!fixedModel;
  const {
    renderOverlay,
    catalogModal,
    onOpenChange: onModelPickerOpenChange,
  } = useDeploymentSelectorOverlay();
  const { t } = useTranslation();
  const {
    items,
    setSelectedItemId,
    isLoading,
    toolsets,
    activeDeploymentId,
    selectedDeployment,
    isSelectedModelHidden,
    usageDeploymentId,
    deploymentItems,
    fixedDeploymentItems,
    isInputDisabled,
    modelSelectorLabels,
  } = useConversationDeploymentState({ fixedModel });
  /* Set only while the reload notification is shown. */
  const retryConversationReload = hasConversationReloadError
    ? onRetryConversationReload
    : undefined;

  const {
    skillMenuOverlay,
    commandMenu,
    skillCatalogModal,
    skillDetailsPanel,
    message: skillMessage,
    messageRevision: skillMessageRevision,
    activeMentions,
    onDraftChange,
    onBackspaceAtCaret,
    caretPositionOverride,
    selectedSkills,
    isSkillUnsupported,
    resetSkillMentions,
    recognizeMentionsInInsertion,
    renderHistorySkillSegments,
    renderHistorySkills,
    seedSkillMentions: seedComposerSkillMentions,
  } = useSkillSelectorOverlay({
    isSkillsSupported: selectedDeployment?.features?.skillsSupported === true,
  });

  /* A `/skill-name` written in a prompt's text becomes a real mention once inserted ([#9354](https://github.com/epam/ai-dial-chat/issues/9354)). */
  const handlePromptInsertText = useCallback(
    (text: string) => {
      recognizeMentionsInInsertion(text);
      onInsertText?.(text);
    },
    [recognizeMentionsInInsertion, onInsertText],
  );
  const {
    renderOverlay: renderPromptsOverlay,
    promptCatalogModal,
    parametersPopup: promptParametersPopup,
  } = usePromptSelectorOverlay({ onInsertText: handlePromptInsertText });
  const promptsMenuOverlays = useMemo(
    () =>
      onInsertText && renderPromptsOverlay
        ? [
            {
              key: 'prompts',
              title: t(PromptSelectorI18nKeys.AddMenuLabel),
              icon: (
                <IconPrompt
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              renderOverlay: renderPromptsOverlay,
            },
          ]
        : undefined,
    [onInsertText, renderPromptsOverlay, t],
  );
  /*
   * A second, independent hook instance drives the edit surface's mention
   * tracking. Sharing the composer's instance would make starting an edit
   * overwrite whatever the user is drafting for their next message, since
   * `seedSkillMentions` pushes into the same `message`/`messageRevision`
   * channel the live composer above also consumes.
   */
  const {
    skillMenuOverlay: editSkillMenuOverlay,
    commandMenu: editCommandMenu,
    skillCatalogModal: editSkillCatalogModal,
    skillDetailsPanel: editSkillDetailsPanel,
    message: editMessage,
    messageRevision: editMessageRevision,
    activeMentions: editActiveMentions,
    onDraftChange: onEditDraftChange,
    onBackspaceAtCaret: onEditBackspaceAtCaret,
    caretPositionOverride: editCaretPositionOverride,
    selectedSkills: editSelectedSkills,
    resetSkillMentions: resetEditSkillMentions,
    seedSkillMentions,
  } = useSkillSelectorOverlay({
    isSkillsSupported: selectedDeployment?.features?.skillsSupported === true,
  });
  /*
   * The skills an edit send writes. The edit instance's selection IS the
   * edited message's mention state (seeded on edit start), so an empty array
   * means the user removed every mention.
   */
  const editSkills = useMemo<RequestSkill[] | undefined>(
    () => editSelectedSkills ?? [],
    [editSelectedSkills],
  );

  const {
    composerSeedText,
    composerSeedRevision,
    handleDraftChange,
    sendWithDraft,
  } = useComposerDraftWiring({
    conversationId: conversation.id,
    inputContent,
    inputContentRevision,
    selectedDeployment,
    isLoading,
    onDraftChange,
    seedComposerSkillMentions,
    selectedSkills,
    skillMessage,
    skillMessageRevision,
  });
  /*
   * The Skills entry joins the Prompts entry in array order, so it renders
   * below Prompts in the `+` menu; `undefined` when both are absent keeps
   * the `+` button's empty-menu rule intact.
   */
  const menuOverlays = useMemo(() => {
    const entries = [
      ...(promptsMenuOverlays ?? []),
      ...(skillMenuOverlay ? [skillMenuOverlay] : []),
    ];
    return entries.length > 0 ? entries : undefined;
  }, [promptsMenuOverlays, skillMenuOverlay]);
  const { showErrorNotification, showSuccessNotification } = useNotification();
  const isMobile = useIsMobile();
  const { preference: sendOnEnter } = useKeyboardShortcutPreference();
  const { user } = useUser();
  const {
    config: { maxAttachmentFileSizeBytes },
  } = useAppConfig();
  const isUsageLimitsControlEnabled = useFeatureFlag('usageLimitsControl');
  const overlay = useOptionalOverlay();
  const isDisallowChangeAgentEnabled = useUiFeature(
    OverlayFeature.DisallowChangeAgent,
  );
  const isHideChangeAgentEnabled = useUiFeature(OverlayFeature.HideChangeAgent);
  const isDisabledSendEnabled = useUiFeature(OverlayFeature.DisabledSend);
  const isSkipFocusChatInputOnloadEnabled = useUiFeature(
    OverlayFeature.SkipFocusChatInputOnload,
  );
  const isInputFilesEnabled = useUiFeature(OverlayFeature.InputFiles);
  const isChatSettingsEnabled = useUiFeature(OverlayFeature.ChatSettings);
  const isRemovableToolsEnabled = useUiFeature(OverlayFeature.RemovableTools);
  const isInputHistoryNavigationDisabled = useUiFeature(
    OverlayFeature.DisableInputHistoryNavigation,
  );
  // bucket is the authenticated user's DIAL Core storage bucket from their profile
  const bucket = user?.bucket ?? '';
  const {
    isOpen: isDialFileManagerOpen,
    openModal: handleOpenDialFileManager,
    closeModal: closeDialFileManager,
    pendingAttachments: pendingDialAttachments,
    clearPendingAttachments: clearPendingDialAttachments,
    handleAttach: handleAttachDialFiles,
  } = useDialFileManagerState(bucket);
  const [attachmentsAmount, setAttachmentsAmount] = useState(0);
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const startCanvasRequest = useLatestCanvasRequest();
  /* Applies to existing messages as well as new ones, which is what the
     chat-settings hint promises — the format is a property of the
     conversation, not of the message it was chosen before. */
  const responseFormat = normalizeResponseFormat(conversation.responseFormat);
  const fallbackCitationGroups = useConversationAnnotationPool(conversation);
  const { mcpAppCache, openMcpAppCanvas, mcpAppTools } = useConversationMcpApps(
    { conversationId: conversation.id, selectedDeployment, messages, toolsets },
  );
  const { openCanvas, attachmentId: selectedAttachmentKey } =
    useAttachmentCanvas();

  const handlePreviewReference = useCallback(
    (annotation: Annotation) => {
      const attachment = annotation.body?.source?.attachment;
      if (!attachment) return;
      const canvasContent = referenceAttachmentToPdfCanvasContent(
        attachment,
        attachmentCanvasUrlResolvers,
      );
      if (canvasContent) openCanvas(canvasContent, attachment.title);
    },
    [openCanvas],
  );

  const isEditActive = !!editingMessageIndexes?.size;

  const handleAttachmentValidationError = useCallback(
    (event: AttachmentValidationErrorEvent) =>
      showErrorNotification(buildAttachmentValidationNotification(event, t)),
    [showErrorNotification, t],
  );

  const {
    inputAttachmentTypes,
    isAttachmentsAllowed,
    validateAttachment,
    fileAccept,
  } = useAttachmentValidation({
    allowedMimeTypes: selectedDeployment?.inputAttachmentTypes ?? [],
    maxFileSizeBytes: maxAttachmentFileSizeBytes,
    onValidationError: handleAttachmentValidationError,
  });

  /*
   * A long plain-text paste converts to a `text/plain` attachment only on
   * models whose attachment types accept one (`text/plain`, `text/*`, or an
   * all-types wildcard); an image-only model would reject the converted
   * attachment.
   */
  const isTextAttachmentsAllowed = isMimeTypeAllowed(
    'text/plain',
    inputAttachmentTypes,
  );

  /*
   * A selector the user cannot act on is removed rather than dimmed: a greyed-out
   * icon with a caret advertises a menu that never opens, and where a deployment
   * cannot be changed the icon carries no actionable information either.
   * `deployments: undefined` is the lib's own hide path (the same one
   * `NewConversationComposer` uses for `hide-empty-chat-change-agent`) and leaves
   * the send button enabled, because `Input` reads an absent selector as "model
   * already resolved".
   *
   * `fixedModel` is deliberately excluded. It reaches this component only from
   * the app editor's preview pane, whose empty state renders the same chip
   * through `NewConversationComposer` — hiding it here alone would make that
   * pane lose the chip the moment the first message is sent.
   */
  const isAgentSelectorHidden =
    isHideChangeAgentEnabled || isDisallowChangeAgentEnabled;
  const agentSelectorItems = isModelFixed
    ? fixedDeploymentItems
    : deploymentItems;

  /*
   * While the composer input is disabled a page drop is rejected the same way
   * as on a deployment without attachments: the denied overlay explains it and
   * the drop is cancelled, so the browser does not open the file. Passing
   * `isEnabled = false` instead would hide the overlay but leave the drop
   * uncancelled. A message being edited keeps accepting drops — its editor is
   * not governed by `isInputDisabled`.
   */
  const isPageDropAllowed =
    isAttachmentsAllowed && (isEditActive || !isInputDisabled);

  const { isDragging, pendingFiles, onFilesConsumed } = usePageFileDrag(
    isPageDropAllowed,
    !isDialFileManagerOpen,
  );

  const reply = useMessageSelectionReply({
    conversationId: conversation.id,
    enabled:
      !isReadOnly &&
      !isEditActive &&
      !isAssistantTyping &&
      !isInputDisabled &&
      !isDisabledSendEnabled &&
      !isSkillUnsupported &&
      !isSelectedModelHidden &&
      isInputFilesEnabled &&
      isAttachmentsAllowed &&
      isTextAttachmentsAllowed &&
      !!selectedDeployment &&
      !!onUploadAttachment,
    droppedFiles: pendingFiles,
    onDroppedFilesConsumed: onFilesConsumed,
  });

  const {
    deploymentLookup,
    tooltips,
    ariaLabels,
    formatStatusModelChangedBody,
    stepsLabel,
  } = useMessageListLabels({ items });

  /*
   * For each message, resolve the deployment active at that point in the conversation.
   * Scans status messages in order so messages before a model change get the initial model icon.
   */
  const effectiveDeploymentIds = useMemo(
    () => getEffectiveDeploymentIds(messages, initialModelId),
    [messages, initialModelId],
  );

  const messageHistory = useMemo(
    () => getInputMessageHistory(messages, isInputHistoryNavigationDisabled),
    [messages, isInputHistoryNavigationDisabled],
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

  const {
    handleSendWithAnchor,
    handleRegenerateMessageWithAnchor,
    handleStartEdit,
    handleCancelEdit,
    handleEditMessageWithAnchor,
  } = useAnchoredMessageActions({
    messages,
    isAssistantTyping,
    onSend,
    onRegenerateMessage,
    onStartEdit,
    onCancelEdit,
    onEditMessage,
    armAnchor,
    sendWithDraft,
    selectedSkills,
    resetSkillMentions,
    seedSkillMentions,
    resetEditSkillMentions,
    editSkills,
  });

  const editMenuOverlays = useMemo(
    () => (editSkillMenuOverlay ? [editSkillMenuOverlay] : undefined),
    [editSkillMenuOverlay],
  );

  const chatSettingsLabels = useChatSettingsFormLabels();
  const chatSettings = useChatSettingsFormConfig({
    mode: 'conversation',
    conversation,
    onConversationChange,
    deploymentFeatures: selectedDeployment?.features,
    isQuickApp: isQuickAppSchema({
      id: selectedDeployment?.applicationTypeSchemaId,
    }),
    labels: chatSettingsLabels,
    onSaved: () =>
      showSuccessNotification({
        message: chatSettingsLabels.savedNotification,
      }),
  });

  const handleReplyAttachmentsChange = reply.onAttachmentsChange;
  const handleAttachmentsChange = useCallback(
    (attachments: Attachment[]) => {
      handleReplyAttachmentsChange(attachments);
      setAttachmentsAmount(attachments.length);
      onAttachmentsChange?.(attachments);
    },
    [onAttachmentsChange, handleReplyAttachmentsChange],
  );

  const handleAttachmentsLimitExceeded = useCallback(
    (count: number, limit: number) => {
      showErrorNotification({
        title: t(DialFileManagerI18nKeys.TooManyFilesSelected),
        message: t(DialFileManagerI18nKeys.TooManyFilesDescription, {
          count,
          limit,
        }),
      });
    },
    [showErrorNotification, t],
  );

  const handleMessageTooLong = useCallback(
    (_length: number, max: number) => {
      showErrorNotification({
        message: t(ConversationI18nKeys.MessageTooLong, { max }),
      });
    },
    [showErrorNotification, t],
  );

  const handleInputAttachmentClick = useCallback(
    (attachment: DisplayAttachment) => {
      void openAttachmentCanvas(attachment, undefined, startCanvasRequest());
    },
    [openAttachmentCanvas, startCanvasRequest],
  );

  const handleMessageAttachmentClick = useCallback(
    (attachment: DisplayAttachment, messageIndex: number) => {
      /*
       * DisplayAttachment.id is derived from content (url/data/title), so the
       * same id can recur across different messages (e.g. the same file
       * attached twice) — prefix with the message index so the "selected"
       * tile highlight can't spuriously match a different message's tile.
       */
      void openAttachmentCanvas(
        attachment,
        `${messageIndex}:${attachment.id}`,
        startCanvasRequest(),
      );
    },
    [openAttachmentCanvas, startCanvasRequest],
  );

  return (
    <>
      <MessageSelectionReply
        rect={reply.selection?.rect}
        actionRef={reply.actionRef}
        onReply={reply.onReply}
        addedRevision={reply.addedRevision}
        labels={{
          reply: t(ChatI18nKeys.Reply),
          selectionAvailable: t(ChatI18nKeys.ReplySelectionAvailable),
          attachmentAdded: t(ChatI18nKeys.ReplyAttachmentAdded),
        }}
      />
      <FileDndOverlay
        isVisible={isDragging}
        isAttachmentsAllowed={isPageDropAllowed}
        labels={{
          title: t(
            isPageDropAllowed
              ? BasicI18nKeys.AttachFiles
              : FileDndI18nKeys.OverlayDeniedTitle,
          ),
          subtitle: t(
            isPageDropAllowed
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
          /*
           * `relative` makes the scroller the containing block for absolutely
           * positioned descendants (e.g. `sr-only` live regions in message
           * actions). Without it they overflow the `overflow-hidden` wrapper
           * above, which keyboard selection (Shift+ArrowUp) can then scroll,
           * pushing the whole message list out of view (#9137).
           */
          className="relative flex w-full flex-1 flex-col overflow-x-hidden overflow-y-auto"
        >
          <div
            ref={contentRef}
            className="mx-auto flex w-full max-w-[760px] min-w-0 shrink-0 flex-col gap-[26px] px-6 pt-7"
          >
            {topContent}
            {messages.map((msg, index) => {
              const isThisMessageEditing = editingMessageIndexes?.has(index);
              return (
                <div
                  key={index.toString()}
                  ref={(el) => setMessageRef(index, el)}
                >
                  <ConversationMessageItem
                    msg={msg}
                    hasTimestamp={hasMessageTimestamps}
                    contentRef={reply.contentRef}
                    index={index}
                    totalCount={messages.length}
                    isAssistantTyping={isAssistantTyping}
                    isCompactTypography={isMobile}
                    responseFormat={responseFormat}
                    fallbackCitationGroups={fallbackCitationGroups}
                    editingMessageIndexes={editingMessageIndexes}
                    onSelectStarter={onSelectStarter}
                    onVisualizerSendMessage={onVisualizerSendMessage}
                    onStartEdit={isReadOnly ? undefined : handleStartEdit}
                    onDeleteMessage={isReadOnly ? undefined : onDeleteMessage}
                    onRegenerateMessage={
                      isReadOnly ? undefined : handleRegenerateMessageWithAnchor
                    }
                    onRateMessage={isReadOnly ? undefined : onRateMessage}
                    onDislikeMessage={isReadOnly ? undefined : onDislikeMessage}
                    onCancelEdit={handleCancelEdit}
                    onEditMessage={handleEditMessageWithAnchor}
                    editMessage={editMessage}
                    editMessageRevision={editMessageRevision}
                    editActiveMentions={editActiveMentions}
                    onEditBackspaceAtCaret={onEditBackspaceAtCaret}
                    editCaretPositionOverride={editCaretPositionOverride}
                    onEditDraftChange={onEditDraftChange}
                    editCommandMenu={editCommandMenu}
                    editMenuOverlays={editMenuOverlays}
                    editSendOnEnter={sendOnEnter}
                    renderHistorySkillSegments={renderHistorySkillSegments}
                    renderHistorySkills={renderHistorySkills}
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
                    stoppedGeneratingText={stoppedGeneratingText}
                    thinkingLabel={t(ChatI18nKeys.Thinking)}
                    executedLabel={t(ConversationI18nKeys.StagesExecuted)}
                    stepsLabel={stepsLabel}
                    onOpenApp={openMcpAppCanvas}
                    mcpAppTools={mcpAppTools}
                    mcpAppCache={mcpAppCache}
                    openedInCanvasLabel={t(
                      AttachmentCanvasI18nKeys.OpenedInCanvasLabel,
                    )}
                    onPreviewReference={handlePreviewReference}
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
                    isAttachmentsEnabled={
                      selectedDeployment != null
                        ? isAttachmentsAllowed
                        : undefined
                    }
                    isTextAttachmentsAllowed={
                      selectedDeployment != null
                        ? isTextAttachmentsAllowed
                        : undefined
                    }
                    maximumAttachmentsAmount={
                      selectedDeployment?.maxInputAttachments
                    }
                    onAttachmentsLimitExceeded={handleAttachmentsLimitExceeded}
                    hideAttachFile={
                      !isAttachmentsAllowed || !isInputFilesEnabled
                    }
                    fileAccept={fileAccept}
                    onAttachmentClick={handleMessageAttachmentClick}
                    selectedAttachmentKey={selectedAttachmentKey}
                    onDialFileSystemClick={
                      isAttachmentsAllowed
                        ? handleOpenDialFileManager
                        : undefined
                    }
                    dialFileSystemLabel={t(
                      ConversationI18nKeys.AttachMenuDialFileSystem,
                    )}
                    pendingAttachments={
                      isEditActive && isThisMessageEditing
                        ? pendingDialAttachments
                        : undefined
                    }
                    onPendingAttachmentsConsumed={
                      isEditActive && isThisMessageEditing
                        ? clearPendingDialAttachments
                        : undefined
                    }
                    onMessageTooLong={handleMessageTooLong}
                  />
                </div>
              );
            })}
            {retryConversationReload != null && (
              <ConversationReloadNotification
                isReloading={isReloadingConversation}
                isStreaming={isAssistantTyping}
                onRetry={retryConversationReload}
              />
            )}
          </div>
          <div
            ref={spacerRef}
            aria-hidden="true"
            className="shrink-0"
            style={{ height: 0 }}
          />
        </div>

        {/* The reload notification mounts inside the log on demand; this
            always-mounted region carries its announcement instead. */}
        <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
          {retryConversationReload != null
            ? `${t(ChatI18nKeys.ConversationReloadErrorTitle)} ${t(ChatI18nKeys.ConversationReloadError)}`
            : ''}
        </LiveRegion>

        {isScrollButtonVisible && (
          <FabButton
            aria-label={t(ChatI18nKeys.ScrollToBottom)}
            onClick={scrollToBottom}
            className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2"
          />
        )}
      </div>

      <div
        role="region"
        aria-label={t(ChatI18nKeys.MessageInput)}
        className="relative z-10 w-full px-6"
      >
        {isReadOnly ? (
          <ConversationReadOnlyFooter
            duplicateError={duplicateError}
            isDuplicateUnavailable={isDuplicateUnavailable}
            onDuplicateConversation={onDuplicateConversation}
          />
        ) : (
          <>
            {/* Empty while the model is available, so it takes no space. */}
            <LiveRegion
              as={LiveRegionElement.P}
              className={mergeClasses(
                'dial-small-text text-center text-secondary',
                isSelectedModelHidden && 'pb-2',
              )}
            >
              {isSelectedModelHidden &&
                t(ConversationI18nKeys.ModelUnavailableNotice)}
            </LiveRegion>
            <Suspense fallback={null}>
              <ConversationInput
                key={conversation.id}
                focusRequestId={reply.focusRequestId}
                message={composerSeedText}
                messageRevision={composerSeedRevision}
                onChange={handleDraftChange}
                textInsertion={inputInsertion}
                onSend={handleSendWithAnchor}
                onUploadAttachment={onUploadAttachment}
                onStop={canStopAssistant ? onStop : undefined}
                isStreaming={isAssistantTyping}
                onAttachmentsChange={handleAttachmentsChange}
                placeholder={placeholder}
                removeLabel={t(AttachmentsI18nKeys.RemoveLabel)}
                retryLabel={t(AttachmentsI18nKeys.RetryLabel)}
                uploadingLabel={t(AttachmentsI18nKeys.UploadingLabel)}
                expandLabel={t(AttachmentsI18nKeys.ExpandPastedText)}
                clickLabel={t(ButtonsI18nKeys.OpenInCanvas)}
                deployments={
                  isAgentSelectorHidden ? undefined : agentSelectorItems
                }
                selectedDeploymentId={
                  selectedDeployment?.id ?? activeDeploymentId
                }
                onDeploymentChange={fixedModel ? undefined : setSelectedItemId}
                isModelSelectorDisabled={isModelFixed}
                isSendDisabled={
                  isDisabledSendEnabled ||
                  isSkillUnsupported ||
                  isSelectedModelHidden
                }
                isInputDisabled={isInputDisabled}
                modelSelectorLabels={modelSelectorLabels}
                addMenuTitle={t(ButtonsI18nKeys.Add)}
                sendLabel={t(ChatI18nKeys.SendMessage)}
                sendTooltip={t(ChatI18nKeys.SendMessage)}
                stopLabel={t(ChatI18nKeys.StopStreaming)}
                isAudioMessageSupported={isAudioMessageSupported}
                isVoiceRecordingSupported={isVoiceRecordingSupported}
                onTranscribeAudio={onTranscribeAudio}
                transcribingLabel={t(VoiceRecordingI18nKeys.Transcribing)}
                voiceErrorLabel={t(VoiceRecordingI18nKeys.Failed)}
                micLabel={t(VoiceRecordingI18nKeys.MicLabel)}
                recordVoiceLabel={t(VoiceRecordingI18nKeys.RecordVoiceLabel)}
                stopRecordingLabel={t(
                  VoiceRecordingI18nKeys.StopRecordingLabel,
                )}
                discardRecordingLabel={t(
                  VoiceRecordingI18nKeys.DiscardRecordingLabel,
                )}
                messageHistory={messageHistory}
                sendOnEnter={sendOnEnter}
                chatSettings={isChatSettingsEnabled ? chatSettings : undefined}
                toolsMenuItems={toolsMenuItems}
                onToolToggle={onToolToggle}
                canRemoveTools={isRemovableToolsEnabled}
                toolsMenuTitle={toolsMenuTitle}
                toolsChipLabels={toolsChipLabels}
                isToolChipRowAllowedOnPhone={overlay != null}
                pendingDropFiles={
                  !isEditActive ? reply.pendingFiles : undefined
                }
                pendingAttachments={
                  !isEditActive ? pendingDialAttachments : undefined
                }
                onDropFilesConsumed={
                  !isEditActive ? reply.onFilesConsumed : undefined
                }
                onPendingAttachmentsConsumed={
                  !isEditActive ? clearPendingDialAttachments : undefined
                }
                autoFocus={!isMobile && !isSkipFocusChatInputOnloadEnabled}
                onDialFileSystemClick={
                  isAttachmentsAllowed ? handleOpenDialFileManager : undefined
                }
                dialFileSystemLabel={t(
                  ConversationI18nKeys.AttachMenuDialFileSystem,
                )}
                validateAttachment={
                  selectedDeployment != null ? validateAttachment : undefined
                }
                isAttachmentsEnabled={
                  selectedDeployment != null ? isAttachmentsAllowed : undefined
                }
                isTextAttachmentsAllowed={
                  selectedDeployment != null
                    ? isTextAttachmentsAllowed
                    : undefined
                }
                maximumAttachmentsAmount={
                  selectedDeployment?.maxInputAttachments
                }
                onAttachmentsLimitExceeded={handleAttachmentsLimitExceeded}
                hideAttachFile={!isAttachmentsAllowed || !isInputFilesEnabled}
                fileAccept={fileAccept}
                onAttachmentClick={handleInputAttachmentClick}
                modelPickerOverlay={isModelFixed ? undefined : renderOverlay}
                onModelPickerOpenChange={onModelPickerOpenChange}
                menuOverlays={menuOverlays}
                activeMentions={activeMentions}
                onBackspaceAtCaret={onBackspaceAtCaret}
                caretPositionOverride={caretPositionOverride}
                commandMenu={commandMenu}
                onMessageTooLong={handleMessageTooLong}
                usageLimitsSlot={
                  isUsageLimitsControlEnabled ? (
                    <UsageLimitsControl
                      deploymentId={usageDeploymentId}
                      isGenerationInProgress={isAssistantTyping}
                    />
                  ) : undefined
                }
                aboveInputSlot={
                  isUsageLimitsControlEnabled ? undefined : (
                    <UsageLimitBanner
                      deploymentId={usageDeploymentId}
                      isGenerationInProgress={isAssistantTyping}
                    />
                  )
                }
              />
            </Suspense>
            <ConversationFileManagerModal
              isDialFileManagerOpen={isDialFileManagerOpen}
              closeDialFileManager={closeDialFileManager}
              handleAttachDialFiles={handleAttachDialFiles}
              bucket={bucket}
              inputAttachmentTypes={inputAttachmentTypes}
              maxAttachmentFileSizeBytes={maxAttachmentFileSizeBytes}
              selectedDeployment={selectedDeployment}
              attachmentsAmount={attachmentsAmount}
            />
          </>
        )}
      </div>
      {/*
       * FooterMessage is intentionally co-located with each view that can
       * render a footer message (ConversationView, NewConversationComposer,
       * NavPageContent). Only one view is visible at a time, so at most one
       * instance is active. If the footer feature grows to require shared
       * dialog state across views, lift FooterMessage to a single top-level
       * provider instead.
       */}
      <FooterMessage />
      {catalogModal}
      {promptCatalogModal}
      {promptParametersPopup}
      {skillCatalogModal}
      {skillDetailsPanel}
      {editSkillCatalogModal}
      {editSkillDetailsPanel}
    </>
  );
};

export default memo(ConversationView);
