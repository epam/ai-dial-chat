import {
  CodeBlockTheme,
  isStatusMessage,
  mergeClasses,
  MessageRole,
  OverlayFeature,
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
import { ErrorMessageNotification } from '@epam/ai-dial-ui-kit';
import { IconLink } from '@tabler/icons-react';
import { FC, lazy, memo, Suspense, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { CitationCardProvider } from '../../context/CitationCardContext';
import { useTheme } from '../../context/ThemeContext';
import { useAnnotations } from '../../hooks/annotations/useAnnotations';
import { useAttachmentAction } from '../../hooks/attachment/useAttachmentAction';
import { useCitationCard } from '../../hooks/citations/useCitationCard';
import { useCitationMarkdownComponents } from '../../hooks/citations/useCitationMarkdownComponents';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ThemeId } from '../../types/theme-id';
import { openAnnotationAttachment } from '../../utils/annotation';
import { referenceAttachmentToPdfCanvasContent } from '../../utils/attachment-canvas';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display';
import { groupAnnotationsBySource } from '../../utils/group-annotations-by-source';
import { messageHasStages } from '../../utils/message-utils';
import {
  getReferenceAttachmentGroups,
  isReferenceOnlyAttachment,
} from '../../utils/reference-attachment';
import CitationDropdown from '../Citations/CitationDropdown/CitationDropdown';
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
  maximumAttachmentsAmount,
  onAttachmentsLimitExceeded,
  hideAttachFile,
  fileAccept,
  onAttachmentClick: onAttachmentClickProp,
  onDialFileSystemClick,
  dialFileSystemLabel,
  pendingAttachments,
  onPendingAttachmentsConsumed,
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
            maximumAttachmentsAmount={maximumAttachmentsAmount}
            onAttachmentsLimitExceeded={onAttachmentsLimitExceeded}
            hideAttachFile={hideAttachFile}
            fileAccept={fileAccept}
            onDialFileSystemClick={onDialFileSystemClick}
            dialFileSystemLabel={dialFileSystemLabel}
            pendingAttachments={pendingAttachments}
            onPendingAttachmentsConsumed={onPendingAttachmentsConsumed}
            onAttachmentClick={handleAttachmentClick}
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
      />
    </CitationCardProvider>
  );
};

export default memo(ConversationMessageItem);
