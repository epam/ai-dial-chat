import {
  mergeClasses,
  MessageRating,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
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
import type { MessageActionsProps } from '../../models/MessageActions';

const COPIED_RESET_MS = 2000;

/** Context-sensitive action bar — shows edit/delete for user messages and regenerate/copy/like/dislike for assistant messages. */
export const MessageActions: FC<MessageActionsProps> = ({
  role = MessageRole.User,
  onEdit,
  onEditHover,
  onDelete,
  onRegenerate,
  onCopy,
  onCopyMarkdown,
  onLike,
  onDislike,
  activeRating,
  isAlwaysVisible,
  className,
  tooltips,
  ariaLabels,
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
        !isAlwaysVisible && 'opacity-0 group-hover:opacity-100',
        className,
      )}
    >
      {role === MessageRole.User ? (
        <>
          <DialGhostIconButton
            icon={<IconPencilMinus size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label={ariaLabels?.editMessage ?? 'Edit message'}
            tooltipProps={{ tooltip: tooltips?.edit ?? 'Edit' }}
            onClick={onEdit}
            onMouseEnter={onEditHover}
          />
          <DialGhostIconButton
            icon={<IconTrashX size={DIAL_ICON_SIZE.SM} />}
            size={ElementSize.Small}
            aria-label={ariaLabels?.deleteMessage ?? 'Delete message'}
            tooltipProps={{ tooltip: tooltips?.delete ?? 'Delete' }}
            onClick={onDelete}
          />
        </>
      ) : (
        <>
          {onRegenerate && (
            <DialGhostIconButton
              icon={<IconRefresh size={DIAL_ICON_SIZE.SM} />}
              size={ElementSize.Small}
              aria-label={
                ariaLabels?.regenerateResponse ?? 'Regenerate response'
              }
              tooltipProps={{ tooltip: tooltips?.regenerate ?? 'Regenerate' }}
              onClick={onRegenerate}
            />
          )}
          {onCopy && (
            <DialGhostIconButton
              icon={
                copied === 'copy' ? (
                  <IconCheck size={DIAL_ICON_SIZE.SM} />
                ) : (
                  <IconCopy size={DIAL_ICON_SIZE.SM} />
                )
              }
              size={ElementSize.Small}
              aria-label={ariaLabels?.copyResponse ?? 'Copy response'}
              tooltipProps={{
                tooltip:
                  copied === 'copy'
                    ? (tooltips?.copied ?? 'Copied!')
                    : (tooltips?.copy ?? 'Copy'),
              }}
              onClick={handleCopy}
            />
          )}
          {onCopyMarkdown && (
            <DialGhostIconButton
              icon={
                copied === 'markdown' ? (
                  <IconCheck size={DIAL_ICON_SIZE.SM} />
                ) : (
                  <IconMarkdown size={DIAL_ICON_SIZE.SM} />
                )
              }
              size={ElementSize.Small}
              aria-label={ariaLabels?.copyAsMarkdown ?? 'Copy as markdown'}
              tooltipProps={{
                tooltip:
                  copied === 'markdown'
                    ? (tooltips?.copiedMarkdown ?? 'Copied!')
                    : (tooltips?.copyMarkdown ?? 'Copy as Markdown'),
              }}
              onClick={handleCopyMarkdown}
            />
          )}
          {onLike && (
            <DialGhostIconButton
              icon={<IconThumbUp size={DIAL_ICON_SIZE.SM} />}
              size={ElementSize.Small}
              aria-label={ariaLabels?.likeResponse ?? 'Like response'}
              className={
                activeRating === MessageRating.Like
                  ? '!text-accent-primary'
                  : undefined
              }
              tooltipProps={{ tooltip: tooltips?.like ?? 'Like' }}
              onClick={onLike}
            />
          )}
          {onDislike && (
            <DialGhostIconButton
              icon={<IconThumbDown size={DIAL_ICON_SIZE.SM} />}
              size={ElementSize.Small}
              aria-label={ariaLabels?.dislikeResponse ?? 'Dislike response'}
              className={
                activeRating === MessageRating.Dislike
                  ? '!text-accent-primary'
                  : undefined
              }
              tooltipProps={{ tooltip: tooltips?.dislike ?? 'Dislike' }}
              onClick={onDislike}
            />
          )}
        </>
      )}
    </div>
  );
};
