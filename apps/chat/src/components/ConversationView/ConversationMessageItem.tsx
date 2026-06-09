import {
  MessageRole,
  isStatusMessage,
  type Attachment,
  type DisplayAttachment,
  type Message as MessageType,
  type MessageRating,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  MessageBubble,
  type MessageActionAriaLabels,
  type MessageActionTooltips,
} from '@epam/ai-dial-conversation-messages';
import { StagesPanel } from '@epam/ai-dial-conversation-stages';
import { DialNotification, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { FC, lazy, memo, Suspense, useCallback, useMemo } from 'react';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display';
import { downloadAttachment } from '../../utils/download-attachment';
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
  onCancelEdit?: (messageIndex: number) => void;
  onEditMessage?: (
    messageIndex: number,
    text: string,
    keptAttachments: DisplayAttachment[],
    newAttachments: Attachment[],
  ) => void;
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
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
  thinkingLabel: string;
  downloadAttachmentLabel: string;
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
  onCancelEdit,
  onEditMessage,
  onUploadAttachment,
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
  thinkingLabel,
  downloadAttachmentLabel,
}) => {
  const msgAttachments = msg.custom_content?.attachments;
  const displayAttachments = useMemo(
    () => attachmentDtosToDisplayAttachments(msgAttachments),
    [msgAttachments],
  );

  const handleDownloadAttachment = useCallback(
    (id: string) => {
      const att = displayAttachments.find((a) => a.id === id);
      if (!att?.url) return;
      downloadAttachment(att.url, att.name ?? id);
    },
    [displayAttachments],
  );

  const isStreaming = isStreamingMessage(
    msg.role,
    index,
    totalCount,
    isAssistantTyping,
  );
  const isEditing =
    msg.role === MessageRole.User && !!editingMessageIndexes?.has(index);

  if (isEditing) {
    return (
      <div className="flex justify-end">
        <Suspense
          fallback={
            <MessageBubble
              role={msg.role}
              text={msg.content}
              attachments={displayAttachments}
              showMoreLabel={showMoreLabel}
              showLessLabel={showLessLabel}
              showMoreAriaLabel={showMoreUserMessageAriaLabel}
              showLessAriaLabel={showLessUserMessageAriaLabel}
              className="justify-end"
            />
          }
        >
          <EditMessageInput
            message={msg.content}
            initialAttachments={displayAttachments}
            onCancel={() => onCancelEdit?.(index)}
            onSave={(text, kept, added) =>
              onEditMessage?.(index, text, kept, added)
            }
            onUploadAttachment={onUploadAttachment}
            cancelLabel={cancelLabel}
            saveLabel={saveLabel}
            ariaLabel={editMessageAriaLabel}
            className="w-full max-w-[748px]"
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

  return (
    <MessageBubble
      role={msg.role}
      text={msg.content}
      attachments={displayAttachments}
      onDownloadAttachment={handleDownloadAttachment}
      downloadAttachmentLabel={downloadAttachmentLabel}
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
              <StagesPanel
                stages={msg.custom_content?.stages ?? []}
                isStreaming={isStreaming}
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
      {...statusProps}
    />
  );
};

export default memo(ConversationMessageItem);
