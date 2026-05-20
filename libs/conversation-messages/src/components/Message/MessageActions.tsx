import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { mergeClasses, MessageRole } from '@epam/chat-shared';
import {
  IconCopy,
  IconMarkdown,
  IconPencil,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react';
import { FC } from 'react';
import type { MessageActionsProps } from '../../models/MessageActions.js';

export const MessageActions: FC<MessageActionsProps> = ({
  source = MessageRole.User,
  onEdit,
  onDelete,
  onRegenerate,
  onCopy,
  onToggleMarkdown,
  onLike,
  onDislike,
  className,
}) => {
  return (
    <div
      className={mergeClasses(
        'flex gap-1 opacity-0 group-hover:opacity-100',
        className,
      )}
    >
      {source === MessageRole.User ? (
        <>
          <DialGhostIconButton
            icon={<IconPencil size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Edit message"
            onClick={onEdit}
          />
          <DialGhostIconButton
            icon={<IconTrash size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Delete message"
            onClick={onDelete}
          />
        </>
      ) : (
        <>
          <DialGhostIconButton
            icon={<IconRefresh size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Regenerate response"
            onClick={onRegenerate}
          />
          <DialGhostIconButton
            icon={<IconCopy size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Copy response"
            onClick={onCopy}
          />
          <DialGhostIconButton
            icon={<IconMarkdown size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Toggle markdown"
            onClick={onToggleMarkdown}
          />
          <DialGhostIconButton
            icon={<IconThumbUp size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Like response"
            onClick={onLike}
          />
          <DialGhostIconButton
            icon={<IconThumbDown size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Dislike response"
            onClick={onDislike}
          />
        </>
      )}
    </div>
  );
};

export default MessageActions;
