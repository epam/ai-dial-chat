import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';
import { mergeClasses } from '@epam/chat-shared';
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

export type MessageSource = 'User' | 'Agent';

interface MessageActionsProps {
  source?: MessageSource;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onToggleMarkdown?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
}

const ICON_SIZE = 16;

export const MessageActions: FC<MessageActionsProps> = ({
  source = 'User',
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
      {source === 'User' ? (
        <>
          <DialGhostIconButton
            icon={<IconPencil size={ICON_SIZE} />}
            size={ElementSize.Small}
            aria-label="Edit message"
            onClick={onEdit}
          />
          <DialGhostIconButton
            icon={<IconTrash size={ICON_SIZE} />}
            size={ElementSize.Small}
            aria-label="Delete message"
            onClick={onDelete}
          />
        </>
      ) : (
        <>
          <DialGhostIconButton
            icon={<IconRefresh size={ICON_SIZE} />}
            size={ElementSize.Small}
            aria-label="Regenerate response"
            onClick={onRegenerate}
          />
          <DialGhostIconButton
            icon={<IconCopy size={ICON_SIZE} />}
            size={ElementSize.Small}
            aria-label="Copy response"
            onClick={onCopy}
          />
          <DialGhostIconButton
            icon={<IconMarkdown size={ICON_SIZE} />}
            size={ElementSize.Small}
            aria-label="Toggle markdown"
            onClick={onToggleMarkdown}
          />
          <DialGhostIconButton
            icon={<IconThumbUp size={ICON_SIZE} />}
            size={ElementSize.Small}
            aria-label="Like response"
            onClick={onLike}
          />
          <DialGhostIconButton
            icon={<IconThumbDown size={ICON_SIZE} />}
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
