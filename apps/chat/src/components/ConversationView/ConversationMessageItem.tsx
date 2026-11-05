import {
  AttachmentContentType,
  groupedVisualizerCanvasKey,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  isMessageStreaming,
  mapStages,
  messageHasStages,
  openAnnotationAttachment,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  type Annotation,
  type Attachment,
  type AttachmentErrorReason,
  CodeBlockTheme,
  type DisplayAttachment,
  isStatusMessage,
  mergeClasses,
  type Message as MessageType,
  type MessageRating,
  MessageRole,
  type RequestSkill,
  type ResponseFormat,
  type StarterOption,
  type TextSegment,
  type UploadedAttachmentResult,
} from '@epam/ai-dial-chat-shared';
import type {
  CommandMenuConfig,
  HighlightedTextRange,
  MenuOverlayConfig,
  SendOnEnter,
} from '@epam/ai-dial-conversation-input';
import {
  MessageBubble,
  type MessageActionAriaLabels,
  type MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { CollapsedGroup } from '@epam/ai-dial-conversation-stages';
import {
  findMcpAppForMessage,
  mcpAppCanvasKey,
  resolveMcpAppToolCallSeed,
  type McpAppResponseCache,
  type McpAppToolCallSeed,
  type McpAppToolRef,
} from '@epam/ai-dial-mcp-apps';
import {
  CitationCardProvider,
  type AnnotationGroup,
} from '@epam/ai-dial-quotations';
import {
  FC,
  memo,
  useCallback,
  useMemo,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationI18nKeys,
} from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { useMcpAppHostAdapter } from '../../hooks/attachment/useMcpAppHostAdapter';
import { useGroupedVisualizer } from '../../hooks/conversation/useGroupedVisualizer';
import { useMessageAttachments } from '../../hooks/conversation/useMessageAttachments';
import { useMessageCitations } from '../../hooks/conversation/useMessageCitations';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ThemeId } from '../../types/theme-id';
import { attachmentDisplayResolvers } from '../../utils/attachment-display-resolvers';
import {
  isAttachmentDownloadable,
  resolveDialFileDownloadUrl,
  resolveMarkdownUrl,
} from '../../utils/dial-file';
import MessageEditMode from './message/MessageEditMode';
import MessageMcpAppPreview from './message/MessageMcpAppPreview';
import MessageReferenceChips from './message/MessageReferenceChips';
import MessageStreamError from './message/MessageStreamError';
import MessageVisualizerSlot from './message/MessageVisualizerSlot';
import { buildMessageActions } from './utils/build-message-actions';
import {
  getMessageStarterProps,
  getStatusMessageProps,
} from './utils/message-display';

const preloadEditInput = () => void import('@epam/ai-dial-conversation-input');

/* Fallback inline-frame height when the registry entry declares neither
   `height` nor `mobileHeight`. */
/*
 * Shared empty array for the default `fallbackCitationGroups`: a default
 * parameter's `[]` is a fresh array on every render, which would break
 * downstream memoisation even when the host passes nothing.
 */
const EMPTY_FALLBACK_CITATION_GROUPS: AnnotationGroup[] = [];

interface Props {
  contentRef?: Ref<HTMLDivElement>;
  msg: MessageType;
  index: number;
  totalCount: number;
  isAssistantTyping: boolean;
  /** Shows the message's relative send time at the start of its action row. */
  hasTimestamp?: boolean;
  editingMessageIndexes?: Set<number>;
  onSelectStarter?: (
    starter: StarterOption,
    propertyKey?: string,
    description?: string,
  ) => void;
  /** Sends a visualizer `SEND_MESSAGE` text; `undefined` while visualizer messages are disabled. */
  onVisualizerSendMessage?: (content: string) => void;
  onStartEdit?: (messageIndex: number) => void;
  onDeleteMessage?: (messageIndex: number) => void;
  onRegenerateMessage?: (messageIndex: number) => void;
  onRateMessage?: (messageIndex: number, rating: MessageRating | null) => void;
  onDislikeMessage?: (messageIndex: number) => void;
  onCancelEdit?: (messageIndex: number) => void;
  onEditMessage?: (
    messageIndex: number,
    text: string,
    keptAttachments: DisplayAttachment[],
    newAttachments: Attachment[],
  ) => void;
  onUploadAttachment?: (
    attachment: Attachment,
  ) => Promise<UploadedAttachmentResult>;
  pendingDropFiles?: File[];
  onDropFilesConsumed?: () => void;
  deploymentLookup: Record<
    string,
    { displayName: string; iconUrl: string | undefined }
  >;
  effectiveDeploymentId?: string;
  tooltips: MessageActionTooltips;
  ariaLabels: MessageActionAriaLabels;
  cancelLabel: string;
  saveLabel: string;
  editMessageAriaLabel: string;
  quickReplyButtonsAriaLabel: string;
  showMoreLabel: string;
  showLessLabel: string;
  showMoreUserMessageAriaLabel: string;
  showLessUserMessageAriaLabel: string;
  statusModelChangedTitle: string;
  formatStatusModelChangedBody: (from: string, to: string) => string;
  stoppedGeneratingText: string;
  thinkingLabel: string;
  executedLabel: string;
  stepsLabel: (count: number) => string;
  /** Called with the message's matched MCP App tool (its canvas key, and a toolInput/toolResult seed) when the user activates the inline preview's expand-to-canvas button. Omit to hide the inline preview entirely. */
  onOpenApp?: (
    match: McpAppToolRef,
    canvasKey?: string,
    toolCall?: McpAppToolCallSeed,
  ) => void;
  /** The active deployment's tools that declare an MCP Apps UI resource. */
  mcpAppTools: McpAppToolRef[];
  /** Shared with `useOpenMcpAppCanvas` so switching between the inline preview and the full canvas for the same message reuses one fetch. */
  mcpAppCache: McpAppResponseCache;
  /** Label shown instead of the inline MCP App preview when this message's canvas is the one currently open. */
  openedInCanvasLabel?: string;
  /** Called when the user clicks the preview button on a PDF citation. */
  onPreviewReference?: (annotation: Annotation) => void;
  validateAttachment?: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  isAttachmentsEnabled?: boolean;
  /** Forwarded to `EditMessageInput`: narrows the long-paste-to-attachment conversion to models whose attachment types accept `text/plain`. */
  isTextAttachmentsAllowed?: boolean;
  /** Renders message text one type-scale step down. The host sets it on narrow viewports. */
  isCompactTypography?: boolean;
  /** The conversation's response format. `ResponseFormat.PlainText` renders the body verbatim instead of as Markdown. */
  responseFormat?: ResponseFormat;
  maximumAttachmentsAmount?: number;
  onAttachmentsLimitExceeded?: (count: number, limit: number) => void;
  hideAttachFile?: boolean;
  /** `accept` attribute value forwarded to the edit-message native file picker. */
  fileAccept?: string;
  /**
   * When provided, called instead of the default download action when an attachment card is activated —
   * the conversation view opens the attachment in the canvas, so the tile is then named "Open in canvas".
   * Receives this item's `index` so the list can pass one stable callback and keep the row memoized.
   */
  onAttachmentClick?: (
    attachment: DisplayAttachment,
    messageIndex: number,
  ) => void;
  /** Called when user selects "DIAL file system" from the edit-message attach menu. When absent, the menu item is not rendered. */
  onDialFileSystemClick?: () => void;
  /** Label for the "DIAL file system" menu item. */
  dialFileSystemLabel?: string;
  /** Already-uploaded attachments supplied by the host and awaiting insertion into the edit-message tray. */
  pendingAttachments?: Attachment[];
  /** Called after `pendingAttachments` have been inserted into the edit-message tray. */
  onPendingAttachmentsConsumed?: () => void;
  /**
   * Message-scoped key (`${messageIndex}:${attachmentId}`) of the attachment
   * currently open in the canvas panel, if any — set by `ConversationView`
   * from the canvas context. Renders that tile's selected visual state only
   * within the message that actually opened it, since `DisplayAttachment.id`
   * alone can recur across different messages.
   */
  selectedAttachmentKey?: string;
  /** Called when the user pastes text that exceeds the max length while attachments are disabled. */
  onMessageTooLong?: (length: number, max: number) => void;
  /**
   * The edit input's live draft text, seeded by the host from the edited
   * message's content plus its tracked skill mentions. Forwarded to
   * `EditMessageInput`'s `message`. Rendered only in the edit branch.
   */
  editMessage?: string;
  /** Token that forces `editMessage` to re-apply (e.g. after a mention is inserted mid-edit). Forwarded to `EditMessageInput`'s `messageRevision`. */
  editMessageRevision?: number;
  /**
   * Ranges of `editMessage` rendered as highlighted runs — the edited
   * message's tracked skill mentions. Forwarded to `EditMessageInput`'s
   * `activeMentions`.
   */
  editActiveMentions?: HighlightedTextRange[];
  /**
   * Looks up a highlighted range whose run ends exactly at the given caret
   * position, without mutating state — the whole-mention Backspace gesture.
   * Forwarded to `EditMessageInput`'s `onBackspaceAtCaret`.
   */
  onEditBackspaceAtCaret?: (
    caretPosition: number,
  ) => HighlightedTextRange | undefined;
  /** Caret offset to place the cursor at once `editMessageRevision` next bumps. Forwarded to `EditMessageInput`'s `caretPositionOverride`. */
  editCaretPositionOverride?: number;
  /**
   * Called with the edit textarea's current value on every change — the
   * host's skill-mention tracking reconciling live edits. Forwarded to
   * `EditMessageInput`'s `onChange`.
   */
  onEditDraftChange?: (nextValue: string) => void;
  /** Host-injected slash-command menu for adding a skill mid-edit. Forwarded to `EditMessageInput`'s `commandMenu`. */
  editCommandMenu?: CommandMenuConfig;
  /** Host-injected `+`-menu entries for adding a skill mid-edit. Forwarded to `EditMessageInput`'s `menuOverlays`. */
  editMenuOverlays?: MenuOverlayConfig[];
  /** The user's send-key preference. Forwarded to `EditMessageInput`'s `sendOnEnter`. */
  editSendOnEnter?: SendOnEnter;
  /**
   * Renders a user message's `content` and `custom_content.skills` as an
   * ordered array interleaving plain-text runs and `ChatSkill` elements at
   * each mention's actual text position, for `MessageBubble`'s `textSegments`
   * prop. Returns `null` while the skill-usage flag is off or the message
   * carries no skills.
   */
  renderHistorySkillSegments?: (
    content: string,
    skills: RequestSkill[] | undefined,
  ) => TextSegment[] | null;
  /**
   * Renders a message's `custom_content.skills` entries as a flat list of
   * `ChatSkill` history elements for the bubble's `beforeContent` slot (the
   * assistant-message path, since assistant text never authors positioned
   * mentions) — name and description resolution and the "View details"
   * details panel are owned by the host's skill selector wiring. Returns
   * `null` while the skill-usage flag is off or the message carries no
   * skills.
   */
  renderHistorySkills?: (skills: RequestSkill[] | undefined) => ReactNode;
  /**
   * Conversation-level pool of citation groups whose annotation arrived in
   * an earlier turn — consulted only for a `<cit data-id="…">` this
   * message's own annotations do not resolve. Derived by `ConversationView`
   * from `conversation.customViewState.annotations`.
   */
  fallbackCitationGroups?: AnnotationGroup[];
}

export type ConversationMessageItemProps = Props;

const ConversationMessageItem: FC<Props> = ({
  msg,
  contentRef,
  index,
  totalCount,
  isAssistantTyping,
  hasTimestamp = false,
  editingMessageIndexes,
  onSelectStarter,
  onVisualizerSendMessage,
  onStartEdit,
  onDeleteMessage,
  onRegenerateMessage,
  onRateMessage,
  onDislikeMessage,
  onCancelEdit,
  onEditMessage,
  onUploadAttachment,
  pendingDropFiles,
  onDropFilesConsumed,
  deploymentLookup,
  effectiveDeploymentId,
  tooltips,
  ariaLabels,
  cancelLabel,
  saveLabel,
  editMessageAriaLabel,
  quickReplyButtonsAriaLabel,
  showMoreLabel,
  showLessLabel,
  showMoreUserMessageAriaLabel,
  showLessUserMessageAriaLabel,
  statusModelChangedTitle,
  formatStatusModelChangedBody,
  stoppedGeneratingText,
  thinkingLabel,
  executedLabel,
  stepsLabel,
  onOpenApp,
  mcpAppTools,
  mcpAppCache,
  openedInCanvasLabel,
  onPreviewReference,
  validateAttachment,
  isAttachmentsEnabled,
  isTextAttachmentsAllowed,
  isCompactTypography = false,
  responseFormat,
  maximumAttachmentsAmount,
  onAttachmentsLimitExceeded,
  hideAttachFile,
  fileAccept,
  onAttachmentClick: onAttachmentClickProp,
  onDialFileSystemClick,
  dialFileSystemLabel,
  pendingAttachments,
  onPendingAttachmentsConsumed,
  selectedAttachmentKey,
  onMessageTooLong,
  editMessage,
  editMessageRevision,
  editActiveMentions,
  onEditBackspaceAtCaret,
  editCaretPositionOverride,
  onEditDraftChange,
  editCommandMenu,
  editMenuOverlays,
  editSendOnEnter,
  renderHistorySkillSegments,
  renderHistorySkills,
  fallbackCitationGroups = EMPTY_FALLBACK_CITATION_GROUPS,
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentTheme } = useTheme();
  const { openCanvas, isOpen: isCanvasOpen } = useAttachmentCanvas();
  const isLikesEnabled = useUiFeature(OverlayFeature.Likes);
  const isEditUserMessageHidden = useUiFeature(
    OverlayFeature.HideEditUserMessage,
  );
  const isRegenerateAssistantMessageHidden = useUiFeature(
    OverlayFeature.HideRegenerateAssistantMessage,
  );
  const isDeleteUserMessageHidden = useUiFeature(
    OverlayFeature.HideDeleteUserMessage,
  );
  const codeBlockTheme =
    currentTheme === ThemeId.Light ? CodeBlockTheme.Light : CodeBlockTheme.Dark;
  const handleTableOpenInCanvas = useCallback(
    (text: string) =>
      openCanvas(
        { type: AttachmentContentType.MarkdownTable, text },
        t(ChatI18nKeys.MarkdownTableTitle),
      ),
    [openCanvas, t],
  );
  const {
    handleAttachmentClick,
    attachmentClickLabel,
    attachmentDownloadLabel,
    handleDownloadAll,
    referenceGroups,
    allDisplayAttachments,
    nonReferenceDisplayAttachments,
    selectedAttachmentId,
  } = useMessageAttachments({
    msg,
    index,
    onAttachmentClick: onAttachmentClickProp,
    selectedAttachmentKey,
  });
  const isStreaming = isMessageStreaming(
    msg,
    index,
    totalCount,
    isAssistantTyping,
  );
  const isEditing =
    msg.role === MessageRole.User && !!editingMessageIndexes?.has(index);

  /* Complete arrays without indexes take positional identities, which their
     `parent_stage_index` refers to; keyed on the stored array reference. */
  const stages = useMemo(
    () => mapStages(msg.custom_content?.stages) ?? [],
    [msg.custom_content?.stages],
  );
  const stageLabels = useMemo(
    () => ({
      executedLabel,
      stepsLabel,
      runningAriaLabel: t(ConversationI18nKeys.StagesRunning),
      failedAriaLabel: t(ConversationI18nKeys.StagesFailed),
      failedCountLabel: (count: number) =>
        t(ConversationI18nKeys.StagesFailedCount, { count }),
      attemptLabel: (number: number) =>
        t(ConversationI18nKeys.StagesAttempt, { number }),
      copyAriaLabel: t(ConversationI18nKeys.StagesCopyContent),
      codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
      tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
      mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
      attachmentClickLabel: t(ConversationI18nKeys.StagesPreviewAttachment),
    }),
    [executedLabel, stepsLabel, t],
  );

  const {
    citationCard,
    messageTextStyles,
    markdownClassNames,
    processedContent,
    markdownComponents,
    renderStageCitation,
    displayStages,
    copyContent,
  } = useMessageCitations({
    msg,
    isStreaming,
    stages,
    fallbackCitationGroups,
    isCompactTypography,
    handleAttachmentClick,
  });
  const {
    groupedVisualizer,
    bubbleAttachments,
    handleExpandGroupedVisualizer,
  } = useGroupedVisualizer({
    effectiveDeploymentId,
    index,
    nonReferenceDisplayAttachments,
  });

  const isStreamErrorRetryShown =
    onRegenerateMessage != null && !isRegenerateAssistantMessageHidden;
  const handleStreamErrorRetry = useCallback(() => {
    onRegenerateMessage?.(index);
  }, [onRegenerateMessage, index]);

  const handleStageAttachmentClick = useCallback(
    (attachment: DisplayAttachment) => {
      if (attachment.data) {
        openCanvas(
          { type: AttachmentContentType.Markdown, text: attachment.data },
          attachment.name,
        );
        return;
      }
      const linkUrl = attachment.url ?? attachment.referenceUrl;
      if (linkUrl) {
        window.open(
          resolveMarkdownUrl(linkUrl),
          '_blank',
          'noopener,noreferrer',
        );
      }
    },
    [openCanvas],
  );

  const handleOpenReferenceInBrowser = useCallback((annotation: Annotation) => {
    const attachment = annotation.body?.source?.attachment;
    if (attachment)
      openAnnotationAttachment(attachment, resolveDialFileDownloadUrl);
  }, []);

  const mcpAppMatch = findMcpAppForMessage(msg, mcpAppTools);
  const mcpAppToolCallSeed = useMemo(
    () =>
      mcpAppMatch
        ? resolveMcpAppToolCallSeed(msg, mcpAppMatch.toolName)
        : undefined,
    [msg, mcpAppMatch],
  );
  const mcpAppHostAdapter = useMcpAppHostAdapter('inline');

  if (isEditing) {
    return (
      <MessageEditMode
        msg={msg}
        index={index}
        cancelLabel={cancelLabel}
        saveLabel={saveLabel}
        editMessageAriaLabel={editMessageAriaLabel}
        showMoreLabel={showMoreLabel}
        showLessLabel={showLessLabel}
        showMoreUserMessageAriaLabel={showMoreUserMessageAriaLabel}
        showLessUserMessageAriaLabel={showLessUserMessageAriaLabel}
        renderHistorySkillSegments={renderHistorySkillSegments}
        editMessage={editMessage}
        editMessageRevision={editMessageRevision}
        editActiveMentions={editActiveMentions}
        onEditBackspaceAtCaret={onEditBackspaceAtCaret}
        editCaretPositionOverride={editCaretPositionOverride}
        onEditDraftChange={onEditDraftChange}
        editCommandMenu={editCommandMenu}
        editMenuOverlays={editMenuOverlays}
        editSendOnEnter={editSendOnEnter}
        onCancelEdit={onCancelEdit}
        onEditMessage={onEditMessage}
        onUploadAttachment={onUploadAttachment}
        pendingDropFiles={pendingDropFiles}
        onDropFilesConsumed={onDropFilesConsumed}
        validateAttachment={validateAttachment}
        isAttachmentsEnabled={isAttachmentsEnabled}
        isTextAttachmentsAllowed={isTextAttachmentsAllowed}
        maximumAttachmentsAmount={maximumAttachmentsAmount}
        onAttachmentsLimitExceeded={onAttachmentsLimitExceeded}
        hideAttachFile={hideAttachFile}
        fileAccept={fileAccept}
        onDialFileSystemClick={onDialFileSystemClick}
        dialFileSystemLabel={dialFileSystemLabel}
        pendingAttachments={pendingAttachments}
        onPendingAttachmentsConsumed={onPendingAttachmentsConsumed}
        onMessageTooLong={onMessageTooLong}
        messageTextStyles={messageTextStyles}
        allDisplayAttachments={allDisplayAttachments}
        attachmentClickLabel={attachmentClickLabel}
        attachmentDownloadLabel={attachmentDownloadLabel}
        handleAttachmentClick={handleAttachmentClick}
        handleDownloadAll={handleDownloadAll}
      />
    );
  }

  const hasStages = messageHasStages(msg);
  const mcpAppKey = mcpAppMatch ? mcpAppCanvasKey(index) : undefined;
  const isMcpAppOpenedInCanvas =
    mcpAppKey != null && selectedAttachmentKey === mcpAppKey;
  const groupedVisualizerKey =
    groupedVisualizer != null ? groupedVisualizerCanvasKey(index) : undefined;
  const isGroupedVisualizerOpenedInCanvas =
    groupedVisualizerKey != null &&
    selectedAttachmentKey === groupedVisualizerKey;
  const { starters: activeStarters, onSelectStarter: handleSelectStarter } =
    getMessageStarterProps(
      msg,
      index,
      totalCount,
      isAssistantTyping,
      onSelectStarter,
    );
  const deploymentEntry =
    effectiveDeploymentId != null
      ? deploymentLookup[effectiveDeploymentId]
      : undefined;

  const statusProps = isStatusMessage(msg)
    ? getStatusMessageProps(
        msg,
        deploymentLookup,
        statusModelChangedTitle,
        formatStatusModelChangedBody,
      )
    : {};

  /*
   * A generation stopped before any token produces an empty assistant message;
   * show a "Stopped generating" label instead of an empty bubble. (The label is
   * rendered, never written into msg.content, so a late token can't corrupt it.)
   */
  const isEmptyStopped =
    msg.role === MessageRole.Assistant &&
    !isStreaming &&
    !!msg.wasStoppedByUser &&
    !msg.content;

  let messageText: string;
  if (isEmptyStopped) {
    messageText = stoppedGeneratingText;
  } else if (msg.role === MessageRole.Assistant) {
    messageText = processedContent;
  } else {
    messageText = msg.content;
  }

  const isUserMessage = msg.role === MessageRole.User;

  const textSegments = isUserMessage
    ? (renderHistorySkillSegments?.(msg.content, msg.custom_content?.skills) ??
      undefined)
    : undefined;
  const beforeContent = isUserMessage
    ? undefined
    : renderHistorySkills?.(msg.custom_content?.skills);

  return (
    <CitationCardProvider value={citationCard}>
      <MessageBubble
        role={msg.role}
        contentRef={contentRef}
        text={messageText}
        textSegments={textSegments}
        beforeContent={beforeContent}
        styles={{
          ...messageTextStyles,
          className: isUserMessage ? 'justify-end' : 'justify-start',
          bubbleClassName: mergeClasses(
            msg.streamErrorMessage != null ? 'w-full' : undefined,
          ),
        }}
        responseFormat={responseFormat}
        markdownComponents={
          msg.role === MessageRole.Assistant ? markdownComponents : undefined
        }
        markdownUrlTransform={resolveMarkdownUrl}
        markdownClassNames={markdownClassNames}
        attachments={bubbleAttachments}
        isStreaming={isStreaming}
        // The stages summary already shows live progress; a second "Thinking" line above it pushes the stages below the avatar.
        hasThinkingPlaceholder={!hasStages}
        hasAlwaysVisibleActions={!isStreaming}
        actions={{
          ...buildMessageActions(
            msg,
            index,
            {
              onEdit:
                !isAssistantTyping && !isEditUserMessageHidden
                  ? onStartEdit
                  : undefined,
              onHoverEdit: preloadEditInput,
              onDelete:
                !isAssistantTyping && !isDeleteUserMessageHidden
                  ? onDeleteMessage
                  : undefined,
              onRegenerate: isRegenerateAssistantMessageHidden
                ? undefined
                : onRegenerateMessage,
              onRate: isLikesEnabled ? onRateMessage : undefined,
              onDislike: isLikesEnabled ? onDislikeMessage : undefined,
            },
            tooltips,
            ariaLabels,
            copyContent,
          ),
          /* Regenerate/copy/like/dislike stay mounted while a response streams,
             so they have to be disabled — otherwise a second generation or a
             rating can be triggered mid-stream. User-message Copy is
             non-mutating and Edit/Delete are not rendered while typing, so
             user toolbars stay enabled. */
          isDisabled: isAssistantTyping && msg.role !== MessageRole.User,
        }}
        timestamp={hasTimestamp ? msg.timestamp : undefined}
        locale={language}
        afterContent={
          referenceGroups.length > 0 ||
          hasStages ||
          mcpAppMatch != null ||
          groupedVisualizer != null ||
          msg.streamErrorMessage != null ? (
            <>
              {referenceGroups.length > 0 && (
                <MessageReferenceChips
                  onPreviewReference={onPreviewReference}
                  referenceGroups={referenceGroups}
                  handleOpenReferenceInBrowser={handleOpenReferenceInBrowser}
                  isCanvasOpen={isCanvasOpen}
                />
              )}
              {hasStages && (
                <CollapsedGroup
                  stages={displayStages}
                  isStreaming={isStreaming}
                  labels={stageLabels}
                  onAttachmentClick={handleStageAttachmentClick}
                  attachmentDisplayResolvers={attachmentDisplayResolvers}
                  renderCitation={renderStageCitation}
                />
              )}
              <MessageVisualizerSlot
                openedInCanvasLabel={openedInCanvasLabel}
                onVisualizerSendMessage={onVisualizerSendMessage}
                groupedVisualizer={groupedVisualizer}
                handleExpandGroupedVisualizer={handleExpandGroupedVisualizer}
                isGroupedVisualizerOpenedInCanvas={
                  isGroupedVisualizerOpenedInCanvas
                }
              />
              {mcpAppMatch && onOpenApp && (
                <MessageMcpAppPreview
                  index={index}
                  mcpAppCache={mcpAppCache}
                  openedInCanvasLabel={openedInCanvasLabel}
                  mcpAppMatch={mcpAppMatch}
                  onOpenApp={onOpenApp}
                  mcpAppToolCallSeed={mcpAppToolCallSeed}
                  mcpAppHostAdapter={mcpAppHostAdapter}
                  mcpAppKey={mcpAppKey}
                  isMcpAppOpenedInCanvas={isMcpAppOpenedInCanvas}
                />
              )}
              {msg.streamErrorMessage != null && (
                <MessageStreamError
                  msg={msg}
                  isAssistantTyping={isAssistantTyping}
                  isStreamErrorRetryShown={isStreamErrorRetryShown}
                  handleStreamErrorRetry={handleStreamErrorRetry}
                />
              )}
            </>
          ) : undefined
        }
        starters={activeStarters}
        onSelectStarter={handleSelectStarter}
        labels={{
          showMoreLabel,
          showLessLabel,
          showMoreAriaLabel: showMoreUserMessageAriaLabel,
          showLessAriaLabel: showLessUserMessageAriaLabel,
          attachmentClickLabel,
          attachmentDownloadLabel,
          attachmentOpenInNewTabLabel: t(AttachmentsI18nKeys.OpenInNewTab),
          startersAriaLabel: quickReplyButtonsAriaLabel,
          thinkingLabel,
          codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
          codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
          codeBlockDownloadLabel: t(ButtonsI18nKeys.Download),
          tableCopyLabel: t(ButtonsI18nKeys.Copy),
          tableCopiedLabel: t(ButtonsI18nKeys.Copied),
          tableDownloadCsvLabel: t(ButtonsI18nKeys.DownloadAsCsv),
          tableOpenInCanvasLabel: t(ButtonsI18nKeys.OpenInCanvas),
          tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
          mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
          ...statusProps,
        }}
        deploymentIconUrl={deploymentEntry?.iconUrl}
        deploymentDisplayName={deploymentEntry?.displayName}
        codeBlockTheme={codeBlockTheme}
        tableOnOpenInCanvas={handleTableOpenInCanvas}
        onAttachmentClick={handleAttachmentClick}
        onDownloadAll={handleDownloadAll}
        isAttachmentDownloadable={isAttachmentDownloadable}
        selectedAttachmentId={selectedAttachmentId}
      />
    </CitationCardProvider>
  );
};

export default memo(ConversationMessageItem);
