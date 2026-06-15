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
  onEdit?: (messageIndex: number) => void;
  onHoverEdit?: () => void;
  onDelete?: (messageIndex: number) => void;
  onRegenerate?: (messageIndex: number) => void;
  onRate?: (messageIndex: number, rating: MessageRating | null) => void;
  onDislike?: (messageIndex: number) => void;
}

export const buildMessageActions = (
  msg: Message,
  index: number,
  handlers: MessageActionHandlers,
  tooltips?: MessageActionTooltips,
  ariaLabels?: MessageActionAriaLabels,
): MessageActionsProps => {
  if (msg.role === MessageRole.Status) {
    return {};
  }

  if (msg.role === MessageRole.User) {
    return {
      onEdit: handlers.onEdit ? () => handlers.onEdit?.(index) : void 0,
      onEditHover: handlers.onHoverEdit,
      onDelete: handlers.onDelete ? () => handlers.onDelete?.(index) : void 0,
      tooltips,
      ariaLabels,
    };
  }

  const onRegenerate = handlers.onRegenerate
    ? () => handlers.onRegenerate?.(index)
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
    onCopyMarkdown: copyToClipboard,
    onLike: handlers.onRate
      ? () =>
          handlers.onRate?.(
            index,
            msg.rating === MessageRating.Like ? null : MessageRating.Like,
          )
      : void 0,
    onDislike:
      handlers.onRate || handlers.onDislike
        ? () => {
            if (msg.rating === MessageRating.Dislike) {
              handlers.onRate?.(index, null);
            } else {
              handlers.onDislike?.(index);
            }
          }
        : void 0,
    activeRating: msg.rating,
    tooltips,
    ariaLabels,
  };
};
