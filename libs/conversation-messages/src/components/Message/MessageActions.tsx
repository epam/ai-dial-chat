import { mergeClasses, MessageRole } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import {
  IconCopy,
  IconMarkdown,
  IconPencilMinus,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
  IconTrashX,
} from '@tabler/icons-react';
import { FC } from 'react';
import type { MessageActionsProps } from '../../models/MessageActions.js';

export const MessageActions: FC<MessageActionsProps> = ({
  role = MessageRole.User,
  onEdit,
  onDelete,
  onRegenerate,
  onCopy,
  onToggleMarkdown,
  onLike,
  onDislike,
  alwaysVisible,
  className,
}) => {
  return (
    <div
      className={mergeClasses(
        'flex gap-1',
        !alwaysVisible && 'opacity-0 group-hover:opacity-100',
        className,
      )}
    >
      {role === MessageRole.User ? (
        <>
          <DialGhostIconButton
            icon={<IconPencilMinus size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label="Edit message"
            onClick={onEdit}
          />
          <DialGhostIconButton
            icon={<IconTrashX size={DIAL_ICON_SIZE.SM} />}
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
