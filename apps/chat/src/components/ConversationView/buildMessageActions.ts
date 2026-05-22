import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import type {
  MessageActionTooltips,
  MessageActionsProps,
} from '@epam/ai-dial-conversation-messages';

export interface MessageActionHandlers {
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export const buildMessageActions = (
  msg: Message,
  handlers: MessageActionHandlers,
  tooltips?: MessageActionTooltips,
): MessageActionsProps => {
  if (msg.role === MessageRole.User) {
    return {
      onDelete: handlers.onDelete ? () => handlers.onDelete?.(msg.id) : void 0,
      tooltips,
    };
  }

  const copyToClipboard = () =>
    navigator.clipboard.writeText(msg.content).catch(() => {
      console.error('Failed to copy message content to clipboard');
    });

  return {
    onRegenerate: handlers.onRegenerate
      ? () => handlers.onRegenerate?.(msg.id)
      : void 0,
    onCopy: copyToClipboard,
    onCopyMarkdown: copyToClipboard, // TODO: add implementation for markdown formatting
    tooltips,
  };
};
