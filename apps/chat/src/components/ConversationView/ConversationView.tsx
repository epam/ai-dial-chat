import {
  useAttachmentCanvas,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  FileDndOverlay,
  isMimeTypeAllowed,
} from '@epam/ai-dial-attachment-input';
import {
  AttachmentValidationErrorReason,
  dialFilesToAttachments,
  dialFolderPathToAttachment,
  findDeploymentByIdOrReference,
  getQuickAppConversationStarters,
  isQuickAppSchema,
  referenceAttachmentToPdfCanvasContent,
  normalizeResponseFormat,
  shouldRerunGenerationOnEdit,
  useAttachmentValidation,
  useChatSettingsFormConfig,
} from '@epam/ai-dial-chat-hooks';
import {
  useMcpAppTools,
  useOpenMcpAppCanvas,
} from '@epam/ai-dial-chat-hooks/mcp-apps';
import { useConversationScroll } from '@epam/ai-dial-chat-hooks/scroll-anchoring';
import { usePageFileDrag } from '@epam/ai-dial-chat-hooks/viewport-layout';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  DisplayAttachment,
  formatFileSize,
  isStatusMessage,
  StatusEvent,
  type Annotation,
  type Attachment,
  type Conversation,
  type MessageRating,
  type Message as MessageType,
  type RequestSkill,
  type StarterOption,
  type ToolMenuItem,
  type UploadedAttachmentResult,
} from '@epam/ai-dial-chat-shared';
import {
  useComposerSeed,
  useComposerSeedSource,
  type TextInsertion,
  type ToolsChipLabels,
} from '@epam/ai-dial-conversation-input';
import type {
  MessageActionAriaLabels,
  MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { useMcpAppResponseCache } from '@epam/ai-dial-mcp-apps';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ErrorMessageNotification,
  FabButton,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { IconCopy, IconPrompt } from '@tabler/icons-react';
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
  ConversationPanelI18nKeys,
  DialFileManagerI18nKeys,
  FileDndI18nKeys,
  PromptSelectorI18nKeys,
  VoiceRecordingI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useAttachmentCanvasResolvers } from '../../hooks/attachment/useAttachmentCanvasResolvers';
import { useMcpAppHostAdapter } from '../../hooks/attachment/useMcpAppHostAdapter';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useChatSettingsFormLabels } from '../../hooks/conversation/useChatSettingsFormLabels';
import { useConversationAnnotationPool } from '../../hooks/conversation/useConversationAnnotationPool';
import { useModelSelectorLabels } from '../../hooks/conversation/useModelSelectorLabels';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useUiFeature } from '../../hooks/useUiFeature';
import { mcpAppsApiClient } from '../../server-api/mcp-apps';
import { attachmentCanvasUrlResolvers } from '../../utils/attachment-display-resolvers';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import { useDeploymentSelectorOverlay } from '../DeploymentSelector/useDeploymentSelectorOverlay';
import type { AttachResult } from '../DialFileManagerModal/types/attach-result';
import FooterMessage from '../FooterMessage/FooterMessage';
import { usePromptSelectorOverlay } from '../PromptSelector/usePromptSelectorOverlay';
import { useSkillSelectorOverlay } from '../SkillSelector/useSkillSelectorOverlay';
import UsageLimitsControl from '../UsageLimitsControl/UsageLimitsControl';
import ConversationMessageItem from './ConversationMessageItem';
import { getInputMessageHistory } from './utils/message-display';

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
  /** Token that forces `inputContent` to re-apply even if its string is unchanged. */
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
  stoppedGeneratingText,
  isReadOnly = false,
  onDuplicateConversation,
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
}) => {
  const isModelFixed = !!fixedModel;
  const { renderOverlay, catalogModal } = useDeploymentSelectorOverlay();
  const {
    renderOverlay: renderPromptsOverlay,
    promptCatalogModal,
    parametersPopup: promptParametersPopup,
  } = usePromptSelectorOverlay({
    onInsertText: onInsertText ?? (() => undefined),
  });
  const { t } = useTranslation();
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
  const { language } = useLanguage();
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
    toolsets,
  } = useDeployments();
  const activeDeploymentId = fixedModel?.id ?? selectedItemId;

  const selectedDeployment = useMemo(() => {
    const deployment = findDeploymentByIdOrReference(items, activeDeploymentId);
    return deployment
      ? {
          ...deployment,
          displayName: resolveLocalizedText(deployment.displayName, language),
          description: resolveLocalizedText(deployment.description, language),
        }
      : undefined;
  }, [items, activeDeploymentId, language]);

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
    renderHistorySkillSegments,
    renderHistorySkills,
  } = useSkillSelectorOverlay({
    isSkillsSupported: selectedDeployment?.features?.skillsSupported === true,
  });
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
  const isSkillUsageEnabled = useFeatureFlag('skillUsageEnabled');
  /*
   * The skills an edit send writes. While the flag is on, the edit instance's
   * selection IS the edited message's mention state (seeded on edit start),
   * so an empty array means the user removed every mention. While the flag
   * is off, `undefined` tells `handleEditMessage` to preserve the message's
   * original skills untouched.
   */
  const editSkills = useMemo<RequestSkill[] | undefined>(
    () => (isSkillUsageEnabled ? (editSelectedSkills ?? []) : undefined),
    [isSkillUsageEnabled, editSelectedSkills],
  );

  /*
   * Merges two independent "seed the composer once" sources into the one
   * message/messageRevision pair ConversationInput accepts: this component's
   * own `inputContent`/`inputContentRevision` props (overlay mode's external
   * content injection) and the skill hook's own message/messageRevision push
   * (a mention insertion).
   */
  const {
    message: composerSeedText,
    messageRevision: composerSeedRevision,
    seedMessage: seedComposerSeed,
  } = useComposerSeed({
    text: inputContent,
    revision: inputContentRevision ?? 0,
  });
  useComposerSeedSource(inputContentRevision, () =>
    seedComposerSeed(inputContent ?? ''),
  );
  useComposerSeedSource(skillMessageRevision, () =>
    seedComposerSeed(skillMessage),
  );
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
  const [isDialFileManagerOpen, setIsDialFileManagerOpen] = useState(false);
  const [pendingDialAttachments, setPendingDialAttachments] = useState<
    Attachment[]
  >([]);
  const [attachmentsAmount, setAttachmentsAmount] = useState(0);
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  /* Applies to existing messages as well as new ones, which is what the
     chat-settings hint promises — the format is a property of the
     conversation, not of the message it was chosen before. */
  const responseFormat = normalizeResponseFormat(conversation.responseFormat);
  const fallbackCitationGroups = useConversationAnnotationPool(conversation);
  const mcpAppCache = useMcpAppResponseCache(conversation.id);
  const mcpAppHostAdapter = useMcpAppHostAdapter('fullscreen');
  const { closePanel } = useConversationPanel();
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();
  const closeMcpAppCanvasBlockers = useCallback(() => {
    closePanel();
    closeSourcesPanel();
  }, [closePanel, closeSourcesPanel]);
  const mcpAppCanvasLabels = useMemo(
    () => ({
      forbiddenErrorLabel: t(
        AttachmentCanvasI18nKeys.McpAppForbiddenErrorLabel,
      ),
      loadErrorLabel: t(AttachmentCanvasI18nKeys.McpAppLoadErrorLabel),
    }),
    [t],
  );
  const { openMcpAppCanvas } = useOpenMcpAppCanvas(
    mcpAppCache,
    mcpAppHostAdapter,
    mcpAppCanvasLabels,
    closeMcpAppCanvasBlockers,
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

  const stepsLabel = useCallback(
    (count: number) => t(ConversationI18nKeys.StagesStep, { count }),
    [t],
  );

  const isEditActive = !!editingMessageIndexes?.size;

  const mcpAppTools = useMcpAppTools(
    mcpAppsApiClient,
    selectedDeployment,
    messages,
    toolsets,
  );

  const handleAttachmentValidationError = useCallback(
    ({
      reason,
      formats,
      maxFileSizeBytes,
    }: {
      reason: AttachmentValidationErrorReason;
      formats?: string;
      maxFileSizeBytes?: number;
    }) => {
      if (reason === AttachmentValidationErrorReason.FileTooLarge) {
        showErrorNotification({
          title: t(AttachmentsI18nKeys.FileTooLargeTitle),
          message: t(AttachmentsI18nKeys.FileTooLargeMessage, {
            maxSize:
              maxFileSizeBytes != null ? formatFileSize(maxFileSizeBytes) : '',
          }),
        });
        return;
      }

      const noTypesAllowed =
        reason === AttachmentValidationErrorReason.NoTypesAllowed;
      showErrorNotification({
        title: t(
          noTypesAllowed
            ? AttachmentsI18nKeys.NoAttachmentsAllowedTitle
            : AttachmentsI18nKeys.UnsupportedTypeTitle,
        ),
        message: t(
          noTypesAllowed
            ? AttachmentsI18nKeys.NoAttachmentsAllowedMessage
            : AttachmentsI18nKeys.UnsupportedTypeMessage,
          noTypesAllowed ? undefined : { formats },
        ),
      });
    },
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
          displayVersion,
          iconUrl,
          type,
          inputAttachmentTypes,
          features,
        }) => ({
          id,
          displayName: resolveLocalizedText(displayName, language),
          displayVersion,
          iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
          type,
          inputAttachmentTypes,
          features,
        }),
      ),
    [items, language],
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

  const hasQuickAppStarters = useMemo(
    () =>
      getQuickAppConversationStarters(selectedDeployment?.conversationStarters)
        .starters.length > 0,
    [selectedDeployment?.conversationStarters],
  );

  const isInputDisabled = useMemo(
    () =>
      !hasQuickAppStarters &&
      !!selectedDeploymentConfiguration?.isChatMessageInputDisabled,
    [hasQuickAppStarters, selectedDeploymentConfiguration],
  );

  const deploymentLookup = useMemo<
    Record<string, { displayName: string; iconUrl: string | undefined }>
  >(
    () =>
      Object.fromEntries(
        items.map((d) => [
          d.id,
          {
            displayName: resolveLocalizedText(d.displayName, language),
            iconUrl: resolveCatalogIconUrl(d.iconUrl),
          },
        ]),
      ),
    [items, language],
  );

  /*
   * For each message, resolve the deployment active at that point in the conversation.
   * Scans status messages in order so messages before a model change get the initial model icon.
   */
  const effectiveDeploymentIds = useMemo<(string | undefined)[]>(() => {
    /* Single linear pass — copying the accumulator per message was O(n²) on long conversations. */
    const result: (string | undefined)[] = [];
    let activeId = initialModelId;
    for (const msg of messages) {
      if (
        isStatusMessage(msg) &&
        msg.custom_content?.event_type === StatusEvent.ModelChanged
      ) {
        activeId = msg.custom_content.new_deployment_id;
      }
      result.push(msg.deploymentId ?? activeId);
    }
    return result;
  }, [messages, initialModelId]);

  const messageHistory = useMemo(
    () => getInputMessageHistory(messages, isInputHistoryNavigationDisabled),
    [messages, isInputHistoryNavigationDisabled],
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
      /* ConversationInput awaits this to know whether to restore the draft
       * on failure — forward onSend's result rather than discarding it. */
      await onSend(message, attachments, selectedSkills);
      /*
       * Clear only after a successful send: a rejected onSend restores the
       * draft, and the mentions should survive with it for the retry.
       * No-op while the skill flag is off.
       */
      resetSkillMentions();
    },
    [onSend, messages.length, armAnchor, selectedSkills, resetSkillMentions],
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

  /*
   * Seeds the edit input with the edited message's full mention state:
   * `seedSkillMentions` reconstructs every mention's position in the
   * message's text, matching `custom_content.skills` in order. A no-op (empty
   * mentions) while the skill flag is off.
   */
  const handleStartEdit = useCallback(
    (messageIndex: number) => {
      const editedMessage = messages[messageIndex];
      seedSkillMentions(
        editedMessage?.content ?? '',
        editedMessage?.custom_content?.skills,
      );
      onStartEdit?.(messageIndex);
    },
    [messages, onStartEdit, seedSkillMentions],
  );

  /*
   * An edit session's mentions never outlive it — otherwise the composer
   * would silently attach the edited message's mentions to the next message.
   * No-op while the skill flag is off.
   */
  const handleCancelEdit = useCallback(
    (messageIndex: number) => {
      resetEditSkillMentions();
      onCancelEdit?.(messageIndex);
    },
    [onCancelEdit, resetEditSkillMentions],
  );

  const handleEditMessageWithAnchor = useCallback(
    (
      messageIndex: number,
      text: string,
      keptAttachments: DisplayAttachment[],
      newAttachments: Attachment[],
    ) => {
      /*
       * handleEditMessage no-ops if a generation is in flight, or if nothing
       * changed and the existing answer is complete (shouldRerunGenerationOnEdit
       * mirrors that same check) — skip arming in either case so a later,
       * unrelated update can't consume a stale index.
       */
      if (
        !isAssistantTyping &&
        shouldRerunGenerationOnEdit(
          messages,
          messageIndex,
          text,
          keptAttachments,
          newAttachments,
          editSkills,
        )
      ) {
        armAnchor(messageIndex);
      }
      onEditMessage?.(
        messageIndex,
        text,
        keptAttachments,
        newAttachments,
        editSkills,
      );
      /* The edit session consumed the mentions; the next edit starts fresh. */
      resetEditSkillMentions();
    },
    [
      isAssistantTyping,
      messages,
      onEditMessage,
      armAnchor,
      editSkills,
      resetEditSkillMentions,
    ],
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

  const handleAttachDialFiles = useCallback(
    (result: AttachResult) => {
      const fileAttachments = dialFilesToAttachments(result.files, bucket, {
        resolvePreviewUrl: resolveCatalogIconUrl,
      });
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
      void openAttachmentCanvas(attachment);
    },
    [openAttachmentCanvas],
  );

  const clearPendingDialAttachments = useCallback(
    () => setPendingDialAttachments([]),
    [],
  );

  const handleMessageAttachmentClick = useCallback(
    (attachment: DisplayAttachment, messageIndex: number) => {
      /*
       * DisplayAttachment.id is derived from content (url/data/title), so the
       * same id can recur across different messages (e.g. the same file
       * attached twice) — prefix with the message index so the "selected"
       * tile highlight can't spuriously match a different message's tile.
       */
      void openAttachmentCanvas(attachment, `${messageIndex}:${attachment.id}`);
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
                    index={index}
                    totalCount={messages.length}
                    isAssistantTyping={isAssistantTyping}
                    isCompactTypography={isMobile}
                    responseFormat={responseFormat}
                    fallbackCitationGroups={fallbackCitationGroups}
                    editingMessageIndexes={editingMessageIndexes}
                    onSelectStarter={onSelectStarter}
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
                    editMenuOverlays={
                      editSkillMenuOverlay ? [editSkillMenuOverlay] : undefined
                    }
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
                        ? () => setIsDialFileManagerOpen(true)
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
          </div>
          <div
            ref={spacerRef}
            aria-hidden="true"
            className="shrink-0"
            style={{ height: 0 }}
          />
        </div>

        {isScrollButtonVisible && (
          <FabButton
            aria-label={t(ChatI18nKeys.ScrollToBottom)}
            onClick={scrollToBottom}
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
          />
        )}
      </div>

      <div
        role="region"
        aria-label={t(ChatI18nKeys.MessageInput)}
        className="relative z-10 w-full px-6"
      >
        {isReadOnly ? (
          <div className="flex flex-col items-center justify-center gap-2 p-4">
            {duplicateError && (
              <ErrorMessageNotification message={duplicateError} />
            )}
            <NeutralButton
              label={t(ConversationPanelI18nKeys.DuplicateReadOnlyDescription)}
              iconBefore={
                <IconCopy
                  size={DIAL_ICON_SIZE.MD}
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              onClick={onDuplicateConversation}
            />
          </div>
        ) : (
          <>
            <Suspense fallback={null}>
              <ConversationInput
                message={composerSeedText}
                messageRevision={composerSeedRevision}
                onChange={onDraftChange}
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
                deployments={
                  isAgentSelectorHidden ? undefined : agentSelectorItems
                }
                selectedDeploymentId={
                  selectedDeployment?.id ?? activeDeploymentId
                }
                onDeploymentChange={fixedModel ? undefined : setSelectedItemId}
                isModelSelectorDisabled={isModelFixed}
                isSendDisabled={isDisabledSendEnabled || isSkillUnsupported}
                isInputDisabled={isInputDisabled}
                modelSelectorLabels={modelSelectorLabels}
                addMenuTitle={t(ConversationI18nKeys.AddMenuTitle)}
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
                autoFocus={!isMobile && !isSkipFocusChatInputOnloadEnabled}
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
                menuOverlays={menuOverlays}
                activeMentions={activeMentions}
                onBackspaceAtCaret={onBackspaceAtCaret}
                caretPositionOverride={caretPositionOverride}
                commandMenu={commandMenu}
                onMessageTooLong={handleMessageTooLong}
                usageLimitsSlot={
                  <UsageLimitsControl
                    deploymentId={
                      selectedDeployment?.id ?? activeDeploymentId ?? undefined
                    }
                    isGenerationInProgress={isAssistantTyping}
                  />
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
                  allowedTypes={inputAttachmentTypes}
                  maxSelectableFileSize={maxAttachmentFileSizeBytes}
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
                    <div className="dial-small-text px-6 py-3">
                      <p className="mb-3 text-secondary">
                        {names.length === 1 ? (
                          <>
                            {t(BasicI18nKeys.DeleteConfirmDescription)}{' '}
                            <span className="break-words text-primary">
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
