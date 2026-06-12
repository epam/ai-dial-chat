import {
  isStatusMessage,
  MessageRole,
  type Attachment,
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
import { FC, lazy, memo, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentsI18nKeys } from '../../constants/translation-keys';
import { useAttachmentAction } from '../../hooks/attachment/useAttachmentAction';
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
  executedLabel: string;
  stepsLabel: (count: number) => string;
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
  executedLabel,
  stepsLabel,
}) => {
  const { t } = useTranslation();
  const { handleAttachmentClick } = useAttachmentAction();
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
      onAttachmentClick={handleAttachmentClick}
      attachmentClickLabel={t(AttachmentsI18nKeys.Download)}
      {...statusProps}
    />
  );
};

export default memo(ConversationMessageItem);
