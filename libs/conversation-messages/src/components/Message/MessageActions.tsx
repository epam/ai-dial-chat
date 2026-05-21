import { mergeClasses, MessageRole } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconCopy,
  IconMarkdown,
  IconPencilMinus,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
  IconTrashX,
} from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';
import type { MessageActionsProps } from '../../models/MessageActions.js';

const COPIED_RESET_MS = 2000;

export const MessageActions: FC<MessageActionsProps> = ({
  role = MessageRole.User,
  onEdit,
  onDelete,
  onRegenerate,
  onCopy,
  onCopyMarkdown,
  onLike,
  onDislike,
  alwaysVisible,
  className,
}) => {
  const [copied, setCopied] = useState<'copy' | 'markdown' | null>(null);

  const handleCopy = useCallback(() => {
    onCopy?.();
    setCopied('copy');
    setTimeout(() => setCopied(null), COPIED_RESET_MS);
  }, [onCopy]);

  const handleCopyMarkdown = useCallback(() => {
    onCopyMarkdown?.();
    setCopied('markdown');
    setTimeout(() => setCopied(null), COPIED_RESET_MS);
  }, [onCopyMarkdown]);

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
            icon={
              copied === 'copy' ? (
                <IconCheck size={DIAL_ICON_SIZE.SM} />
              ) : (
                <IconCopy size={DIAL_ICON_SIZE.SM} />
              )
            }
            size={ElementSize.Small}
            aria-label="Copy response"
            onClick={handleCopy}
          />
          <DialGhostIconButton
            icon={
              copied === 'markdown' ? (
                <IconCheck size={DIAL_ICON_SIZE.SM} />
              ) : (
                <IconMarkdown size={DIAL_ICON_SIZE.SM} />
              )
            }
            size={ElementSize.Small}
            aria-label="Copy as markdown"
            onClick={handleCopyMarkdown}
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
