import {
  CodeBlockTheme,
  isStatusMessage,
  MessageRole,
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
import { DialNotification, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { FC, lazy, memo, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { useTheme } from '../../context/ThemeContext';
import { useAnnotations } from '../../hooks/annotations/useAnnotations';
import { useAttachmentAction } from '../../hooks/attachment/useAttachmentAction';
import { useCitationCard } from '../../hooks/citations/useCitationCard';
import { useCitationMarkdownComponents } from '../../hooks/citations/useCitationMarkdownComponents';
import { ThemeId } from '../../types/theme-id';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display';
import { groupAnnotationsBySource } from '../../utils/group-annotations-by-source';
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

/** Body text style applied to user message bubbles (16px / 26px). */
const USER_MESSAGE_TEXT_STYLES = {
  typography: { fontClassName: 'dial-body-paragraph-text' },
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
  streamErrorText: string;
  stoppedGeneratingText: string;
  thinkingLabel: string;
  executedLabel: string;
  stepsLabel: (count: number) => string;
  validateAttachment?: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  hideAttachFile?: boolean;
  /** When provided, called instead of the default download action when an attachment card is activated. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
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
  streamErrorText,
  stoppedGeneratingText,
  thinkingLabel,
  executedLabel,
  stepsLabel,
  validateAttachment,
  hideAttachFile,
  onAttachmentClick: onAttachmentClickProp,
}) => {
  const { t } = useTranslation();
  const { currentTheme } = useTheme();
  const { handleAttachmentClick: handleDownload } = useAttachmentAction();
  const handleAttachmentClick = onAttachmentClickProp ?? handleDownload;
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
      citationCard,
      handleAttachmentClick,
    );

  if (isEditing) {
    return (
      <div className="flex justify-end">
        <Suspense
          fallback={
            <MessageBubble
              role={msg.role}
              text={msg.content}
              styles={USER_MESSAGE_TEXT_STYLES}
              attachments={attachmentDtosToDisplayAttachments(
                msg.custom_content?.attachments,
              )}
              showMoreLabel={showMoreLabel}
              showLessLabel={showLessLabel}
              showMoreAriaLabel={showMoreUserMessageAriaLabel}
              showLessAriaLabel={showLessUserMessageAriaLabel}
              onAttachmentClick={handleAttachmentClick}
              attachmentClickLabel={t(AttachmentsI18nKeys.Download)}
              className="justify-end"
            />
          }
        >
          <EditMessageInput
            message={msg.content}
            initialAttachments={attachmentDtosToDisplayAttachments(
              msg.custom_content?.attachments,
            )}
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
            hideAttachFile={hideAttachFile}
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

  // A generation stopped before any token produces an empty assistant message;
  // show a "Stopped generating" label instead of an empty bubble. (The label is
  // rendered, never written into msg.content, so a late token can't corrupt it.)
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

  return (
    <MessageBubble
      role={msg.role}
      text={messageText}
      styles={
        msg.role === MessageRole.User ? USER_MESSAGE_TEXT_STYLES : undefined
      }
      markdownComponents={
        msg.role === MessageRole.Assistant ? markdownComponents : undefined
      }
      attachments={attachmentDtosToDisplayAttachments(
        msg.custom_content?.attachments,
      )}
      isStreaming={isStreaming}
      hasAlwaysVisibleActions={!isStreaming}
      actions={buildMessageActions(
        msg,
        index,
        {
          onEdit: !isAssistantTyping ? onStartEdit : undefined,
          onHoverEdit: preloadEditInput,
          onDelete: onDeleteMessage,
          onRegenerate: onRegenerateMessage,
          onRate: onRateMessage,
          onDislike: onDislikeMessage,
        },
        tooltips,
        ariaLabels,
      )}
      className={
        msg.role === MessageRole.User ? 'justify-end' : 'justify-start'
      }
      bubbleClassName={msg.hasStreamError ? 'w-full' : undefined}
      afterContent={
        hasStages || msg.hasStreamError ? (
          <>
            {hasStages && (
              <CollapsedGroup
                stages={msg.custom_content?.stages ?? []}
                isStreaming={isStreaming}
                executedLabel={executedLabel}
                stepsLabel={stepsLabel}
                onAttachmentClick={handleAttachmentClick}
              />
            )}
            {msg.hasStreamError && (
              <div className="w-full">
                <DialNotification
                  variant={NotificationVariant.Error}
                  message={streamErrorText}
                />
              </div>
            )}
          </>
        ) : undefined
      }
      starters={activeStarters}
      onSelectStarter={handleSelectStarter}
      startersAriaLabel={quickReplyButtonsAriaLabel}
      showMoreLabel={showMoreLabel}
      showLessLabel={showLessLabel}
      showMoreAriaLabel={showMoreUserMessageAriaLabel}
      showLessAriaLabel={showLessUserMessageAriaLabel}
      deploymentIconUrl={deploymentEntry?.iconUrl}
      deploymentDisplayName={deploymentEntry?.displayName}
      thinkingLabel={thinkingLabel}
      codeBlockCopyLabel={t(ButtonsI18nKeys.Copy)}
      codeBlockCopiedLabel={t(ButtonsI18nKeys.Copied)}
      codeBlockTheme={
        currentTheme === ThemeId.Light
          ? CodeBlockTheme.Light
          : CodeBlockTheme.Dark
      }
      onAttachmentClick={handleAttachmentClick}
      attachmentClickLabel={t(AttachmentsI18nKeys.Download)}
      {...statusProps}
    />
  );
};

export default memo(ConversationMessageItem);
