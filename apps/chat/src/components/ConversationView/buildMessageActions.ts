import {
  MessageRating,
  MessageRole,
  type Message,
} from '@epam/ai-dial-chat-shared';
import type {
  MessageActionAriaLabels,
  MessageActionTooltips,
  MessageActionsProps,
} from '@epam/ai-dial-conversation-messages';

export interface MessageActionHandlers {
  onEdit?: (messageId: string) => void;
  onHoverEdit?: () => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRate?: (messageId: string, rating: MessageRating | null) => void;
}

export const buildMessageActions = (
  msg: Message,
  handlers: MessageActionHandlers,
  tooltips?: MessageActionTooltips,
  ariaLabels?: MessageActionAriaLabels,
): MessageActionsProps => {
  if (msg.role === MessageRole.Status) {
    return {};
  }

  if (msg.role === MessageRole.User) {
    return {
      onEdit: handlers.onEdit ? () => handlers.onEdit?.(msg.id) : void 0,
      onEditHover: handlers.onHoverEdit,
      onDelete: handlers.onDelete ? () => handlers.onDelete?.(msg.id) : void 0,
      tooltips,
      ariaLabels,
    };
  }

  const onRegenerate = handlers.onRegenerate
    ? () => handlers.onRegenerate?.(msg.id)
    : void 0;

  if (msg.wasStoppedByUser || msg.hasStreamError) {
    return { onRegenerate, tooltips, ariaLabels };
  }

  const copyToClipboard = () =>
    navigator.clipboard.writeText(msg.content).catch(() => {
      console.error('Failed to copy message content to clipboard');
    });

  return {
    onRegenerate,
    onCopy: copyToClipboard,
    onCopyMarkdown: copyToClipboard, // TODO: add implementation for markdown formatting
    onLike: handlers.onRate
      ? () =>
          handlers.onRate?.(
            msg.id,
            msg.rating === MessageRating.Like ? null : MessageRating.Like,
          )
      : void 0,
    onDislike: handlers.onRate
      ? () =>
          handlers.onRate?.(
            msg.id,
            msg.rating === MessageRating.Dislike ? null : MessageRating.Dislike,
          )
      : void 0,
    activeRating: msg.rating,
    tooltips,
    ariaLabels,
  };
};
