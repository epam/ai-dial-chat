import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  CodeBlockTheme,
  isStatusMessage,
  mergeClasses,
  MessageRole,
  type Annotation,
  type Attachment,
  type AttachmentErrorReason,
  type DisplayAttachment,
  type MessageRating,
  type Message as MessageType,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  MessageBubble,
  type MessageActionAriaLabels,
  type MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { CollapsedGroup } from '@epam/ai-dial-conversation-stages';
import {
  CitationCardProvider,
  CitationDropdown,
  getReferenceAttachmentGroups,
  groupAnnotationsBySource,
  isReferenceOnlyAttachment,
  useAnnotations,
  useCitationCard,
} from '@epam/ai-dial-quotations';
import { ErrorMessageNotification } from '@epam/ai-dial-ui-kit';
import { IconLink } from '@tabler/icons-react';
import { FC, lazy, memo, Suspense, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  CitationsI18nKeys,
} from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { useAttachmentAction } from '../../hooks/attachment/useAttachmentAction';
import { useCitationMarkdownComponents } from '../../hooks/citations/useCitationMarkdownComponents';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ThemeId } from '../../types/theme-id';
import { openAnnotationAttachment } from '../../utils/annotation';
import { referenceAttachmentToPdfCanvasContent } from '../../utils/attachment-canvas';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display';
import { messageHasStages } from '../../utils/message-utils';
import { buildMessageActions } from './utils/build-message-actions';
import {
  getMessageStarterProps,
  getStatusMessageProps,
  isStreamingMessage,
} from './utils/message-display';

const EditMessageInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.EditMessageInput };
});

const preloadEditInput = () => void import('@epam/ai-dial-conversation-input');

const USER_MESSAGE_TEXT_STYLES = {
  typography: { fontClassName: 'dial-body-text' },
};

interface Props {
  msg: MessageType;
  index: number;
  totalCount: number;
  isAssistantTyping: boolean;
  editingMessageIndexes?: Set<number>;
  onSelectStarter?: (
    starter: StarterOption,
    propertyKey?: string,
    description?: string,
  ) => void;
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
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
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
  /** Called when the user clicks the preview button on a PDF citation. */
  onPreviewReference?: (annotation: Annotation) => void;
  validateAttachment?: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  isAttachmentsEnabled?: boolean;
  maximumAttachmentsAmount?: number;
  onAttachmentsLimitExceeded?: (count: number, limit: number) => void;
  hideAttachFile?: boolean;
  /** `accept` attribute value forwarded to the edit-message native file picker. */
  fileAccept?: string;
  /** When provided, called instead of the default download action when an attachment card is activated. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
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
}

const ConversationMessageItem: FC<Props> = ({
  msg,
  index,
  totalCount,
  isAssistantTyping,
  editingMessageIndexes,
  onSelectStarter,
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
  onPreviewReference,
  validateAttachment,
  isAttachmentsEnabled,
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
}) => {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
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
  const { handleAttachmentClick: handleDownload } = useAttachmentAction();
  const handleAttachmentClick = onAttachmentClickProp ?? handleDownload;
  const handleDownloadAll = useCallback(
    (attachmentsToDownload: DisplayAttachment[]) => {
      attachmentsToDownload.forEach(handleDownload);
    },
    [handleDownload],
  );
  const isStreaming = isStreamingMessage(
    msg.role,
    index,
    totalCount,
    isAssistantTyping,
  );
  const isEditing =
    msg.role === MessageRole.User && !!editingMessageIndexes?.has(index);

  const annotations = useAnnotations(msg, isStreaming);
  const citationGroups = useMemo(
    () => groupAnnotationsBySource(annotations),
    [annotations],
  );
  const citationCard = useCitationCard();
  const { processedContent, markdownComponents } =
    useCitationMarkdownComponents(
      msg.content,
      citationGroups,
      handleAttachmentClick,
    );
  const referenceGroups = useMemo(
    () => getReferenceAttachmentGroups(msg.custom_content?.attachments),
    [msg.custom_content?.attachments],
  );
  const allDisplayAttachments = useMemo(
    () => attachmentDtosToDisplayAttachments(msg.custom_content?.attachments),
    [msg.custom_content?.attachments],
  );
  const nonReferenceDisplayAttachments = useMemo(
    () =>
      attachmentDtosToDisplayAttachments(
        msg.custom_content?.attachments?.filter(
          (a) => !isReferenceOnlyAttachment(a),
        ),
      ),
    [msg.custom_content?.attachments],
  );
  const handleOpenReferenceInBrowser = useCallback((annotation: Annotation) => {
    const attachment = annotation.body?.source?.attachment;
    if (attachment) openAnnotationAttachment(attachment);
  }, []);

  const selectedAttachmentKeyPrefix = `${index}:`;
  const selectedAttachmentId = selectedAttachmentKey?.startsWith(
    selectedAttachmentKeyPrefix,
  )
    ? selectedAttachmentKey.slice(selectedAttachmentKeyPrefix.length)
    : undefined;

  if (isEditing) {
    return (
      <div className="flex justify-end">
        <Suspense
          fallback={
            <MessageBubble
              role={msg.role}
              text={msg.content}
              styles={{ ...USER_MESSAGE_TEXT_STYLES, className: 'justify-end' }}
              attachments={allDisplayAttachments}
              labels={{
                showMoreLabel,
                showLessLabel,
                showMoreAriaLabel: showMoreUserMessageAriaLabel,
                showLessAriaLabel: showLessUserMessageAriaLabel,
                attachmentClickLabel: t(AttachmentsI18nKeys.Download),
                attachmentOpenInNewTabLabel: t(
                  AttachmentsI18nKeys.OpenInNewTab,
                ),
              }}
              onAttachmentClick={handleAttachmentClick}
              onDownloadAll={handleDownloadAll}
            />
          }
        >
          <EditMessageInput
            message={msg.content}
            initialAttachments={allDisplayAttachments}
            onCancel={() => onCancelEdit?.(index)}
            onSave={(text, kept, added) =>
              onEditMessage?.(index, text, kept, added)
            }
            onUploadAttachment={onUploadAttachment}
            cancelLabel={cancelLabel}
            saveLabel={saveLabel}
            ariaLabel={editMessageAriaLabel}
            className="w-full max-w-[748px]"
            pendingDropFiles={pendingDropFiles}
            onDropFilesConsumed={onDropFilesConsumed}
            validateAttachment={validateAttachment}
            isAttachmentsEnabled={isAttachmentsEnabled}
            maximumAttachmentsAmount={maximumAttachmentsAmount}
            onAttachmentsLimitExceeded={onAttachmentsLimitExceeded}
            hideAttachFile={hideAttachFile}
            fileAccept={fileAccept}
            onDialFileSystemClick={onDialFileSystemClick}
            dialFileSystemLabel={dialFileSystemLabel}
            pendingAttachments={pendingAttachments}
            onPendingAttachmentsConsumed={onPendingAttachmentsConsumed}
            onAttachmentClick={handleAttachmentClick}
            onMessageTooLong={onMessageTooLong}
          />
        </Suspense>
      </div>
    );
  }

  const hasStages = messageHasStages(msg);
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

  return (
    <CitationCardProvider value={citationCard}>
      <MessageBubble
        role={msg.role}
        text={messageText}
        styles={{
          ...(msg.role === MessageRole.User ? USER_MESSAGE_TEXT_STYLES : {}),
          className: isUserMessage ? 'justify-end' : 'justify-start',
          bubbleClassName: mergeClasses(
            msg.streamErrorMessage != null ? 'w-full' : undefined,
          ),
        }}
        markdownComponents={
          msg.role === MessageRole.Assistant ? markdownComponents : undefined
        }
        attachments={nonReferenceDisplayAttachments}
        isStreaming={isStreaming}
        hasAlwaysVisibleActions={!isStreaming}
        actions={buildMessageActions(
          msg,
          index,
          {
            onEdit:
              !isAssistantTyping && !isEditUserMessageHidden
                ? onStartEdit
                : undefined,
            onHoverEdit: preloadEditInput,
            onDelete: isDeleteUserMessageHidden ? undefined : onDeleteMessage,
            onRegenerate: isRegenerateAssistantMessageHidden
              ? undefined
              : onRegenerateMessage,
            onRate: isLikesEnabled ? onRateMessage : undefined,
            onDislike: isLikesEnabled ? onDislikeMessage : undefined,
          },
          tooltips,
          ariaLabels,
        )}
        afterContent={
          referenceGroups.length > 0 ||
          hasStages ||
          msg.streamErrorMessage != null ? (
            <>
              {referenceGroups.length > 0 && (
                <div className="flex w-full flex-wrap gap-2">
                  {referenceGroups.map((group) => {
                    const isPdfPagePreviewable =
                      group.primaryAnnotation.body?.source?.attachment !=
                        null &&
                      referenceAttachmentToPdfCanvasContent(
                        group.primaryAnnotation.body.source.attachment,
                      ) != null;
                    return (
                      <CitationDropdown
                        key={group.sourceUrl}
                        group={group}
                        onPreview={
                          isPdfPagePreviewable ? onPreviewReference : undefined
                        }
                        onOpenInBrowser={handleOpenReferenceInBrowser}
                        icon={<IconLink size={14} aria-hidden />}
                        cardLabels={{
                          ariaLabel: t(CitationsI18nKeys.MarkerAriaLabel, {
                            source: group.sourceName,
                          }),
                          previousCitation: t(
                            CitationsI18nKeys.PopupPreviousCitation,
                          ),
                          nextCitation: t(CitationsI18nKeys.PopupNextCitation),
                          formatSwitcherText: (current, total) =>
                            t(CitationsI18nKeys.PopupSwitcher, {
                              current,
                              total,
                            }),
                          preview: t(BasicI18nKeys.Preview),
                          openInBrowser: t(
                            CitationsI18nKeys.PopupOpenInBrowser,
                          ),
                          download: t(ButtonsI18nKeys.Download),
                        }}
                        markerLabels={{
                          ariaLabel: t(CitationsI18nKeys.MarkerAriaLabel, {
                            source: group.sourceName,
                          }),
                          label: t(CitationsI18nKeys.MarkerLabel, {
                            source: group.sourceName,
                          }),
                          labelWithOverflow: t(
                            CitationsI18nKeys.MarkerLabelWithOverflow,
                            {
                              source: group.sourceName,
                              count: group.annotations.length - 1,
                            },
                          ),
                        }}
                      />
                    );
                  })}
                </div>
              )}
              {hasStages && (
                <CollapsedGroup
                  stages={msg.custom_content?.stages ?? []}
                  isStreaming={isStreaming}
                  labels={{ executedLabel, stepsLabel }}
                />
              )}
              {msg.streamErrorMessage != null && (
                <div className="w-full">
                  <ErrorMessageNotification
                    message={
                      msg.streamErrorMessage || t(ChatI18nKeys.StreamError)
                    }
                  />
                </div>
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
          attachmentClickLabel: t(AttachmentsI18nKeys.Download),
          attachmentOpenInNewTabLabel: t(AttachmentsI18nKeys.OpenInNewTab),
          startersAriaLabel: quickReplyButtonsAriaLabel,
          thinkingLabel,
          codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
          codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
          ...statusProps,
        }}
        deploymentIconUrl={deploymentEntry?.iconUrl}
        deploymentDisplayName={deploymentEntry?.displayName}
        codeBlockTheme={codeBlockTheme}
        onAttachmentClick={handleAttachmentClick}
        onDownloadAll={handleDownloadAll}
        selectedAttachmentId={selectedAttachmentId}
      />
    </CitationCardProvider>
  );
};

export default memo(ConversationMessageItem);
