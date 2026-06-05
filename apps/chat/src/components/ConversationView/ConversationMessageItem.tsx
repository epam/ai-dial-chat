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
import { FC, lazy, memo, Suspense } from 'react';
import { attachmentDtosToDisplayAttachments } from '../../utils/attachment-dto-to-display.js';
import { messageHasStages } from '../../utils/message-utils.js';
import { buildMessageActions } from './utils/buildMessageActions.js';
import {
  getMessageStarterProps,
  getStatusMessageProps,
  isStreamingMessage,
} from './utils/message-display.js';

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
  editingMessageIds?: Set<string>;
  onSelectStarter?: (
    starter: StarterOption,
    propertyKey?: string,
    description?: string,
  ) => void;
  onStartEdit?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  onRateMessage?: (messageId: string, rating: MessageRating | null) => void;
  onCancelEdit?: (messageId: string) => void;
  onEditMessage?: (
    messageId: string,
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
  statusModelChangedTitle: string;
  formatStatusModelChangedBody: (from: string, to: string) => string;
  streamErrorText: string;
}

const ConversationMessageItem: FC<Props> = ({
  msg,
  index,
  totalCount,
  isAssistantTyping,
  editingMessageIds,
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
  statusModelChangedTitle,
  formatStatusModelChangedBody,
  streamErrorText,
}) => {
  const isStreaming = isStreamingMessage(
    msg.role,
    index,
    totalCount,
    isAssistantTyping,
  );
  const isEditing =
    msg.role === MessageRole.User && !!editingMessageIds?.has(msg.id);

  if (isEditing) {
    return (
      <div className="flex justify-end">
        <Suspense
          fallback={
            <MessageBubble
              role={msg.role}
              text={msg.content}
              attachments={attachmentDtosToDisplayAttachments(
                msg.custom_content?.attachments,
              )}
              className="justify-end"
            />
          }
        >
          <EditMessageInput
            message={msg.content}
            initialAttachments={attachmentDtosToDisplayAttachments(
              msg.custom_content?.attachments,
            )}
            onCancel={() => onCancelEdit?.(msg.id)}
            onSave={(text, kept, added) =>
              onEditMessage?.(msg.id, text, kept, added)
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
    effectiveDeploymentId !== undefined
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
      attachments={attachmentDtosToDisplayAttachments(
        msg.custom_content?.attachments,
      )}
      isStreaming={isStreaming}
      hasAlwaysVisibleActions={!isStreaming}
      actions={buildMessageActions(
        msg,
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
      deploymentIconUrl={deploymentEntry?.iconUrl}
      deploymentDisplayName={deploymentEntry?.displayName}
      {...statusProps}
    />
  );
};

export default memo(ConversationMessageItem);
