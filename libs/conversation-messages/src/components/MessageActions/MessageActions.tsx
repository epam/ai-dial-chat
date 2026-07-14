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
import type { MessageActionsProps } from '../../models/message-actions';

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
  labels,
}) => {
  const { tooltips, ariaLabels } = labels ?? {};
  const [copied, setCopied] = useState<'copy' | 'markdown' | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

  const handleCopy = useCallback(() => {
    onCopy?.();
    setCopied('copy');
    setCopyStatus(ariaLabels?.copiedStatus ?? 'Copied to clipboard');
    setTimeout(() => setCopied(null), COPIED_RESET_MS);
  }, [onCopy, ariaLabels?.copiedStatus]);

  const handleCopyMarkdown = useCallback(() => {
    onCopyMarkdown?.();
    setCopied('markdown');
    setCopyStatus(
      ariaLabels?.copiedMarkdownStatus ?? 'Copied as Markdown to clipboard',
    );
    setTimeout(() => setCopied(null), COPIED_RESET_MS);
  }, [onCopyMarkdown, ariaLabels?.copiedMarkdownStatus]);

  return (
    <div
      role="toolbar"
      aria-label={ariaLabels?.actionsGroup ?? 'Message actions'}
      className={mergeClasses(
        'flex gap-1',
        !isAlwaysVisible && 'opacity-0 group-hover:opacity-100',
        className,
      )}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {copyStatus}
      </span>
      {role === MessageRole.User ? (
        <>
          {onEdit && (
            <DialGhostIconButton
              icon={<IconPencilMinus size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              aria-label={ariaLabels?.editMessage ?? 'Edit message'}
              tooltipProps={{ tooltip: tooltips?.edit ?? 'Edit' }}
              onClick={onEdit}
              onMouseEnter={onEditHover}
              onFocus={onEditHover}
            />
          )}
          {onDelete && (
            <DialGhostIconButton
              icon={<IconTrashX size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              aria-label={ariaLabels?.deleteMessage ?? 'Delete message'}
              tooltipProps={{ tooltip: tooltips?.delete ?? 'Delete' }}
              onClick={onDelete}
            />
          )}
        </>
      ) : (
        <>
          {onRegenerate && (
            <DialGhostIconButton
              icon={<IconRefresh size={DIAL_ICON_SIZE.SM} aria-hidden />}
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
                  <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                ) : (
                  <IconCopy size={DIAL_ICON_SIZE.SM} aria-hidden />
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
                  <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />
                ) : (
                  <IconMarkdown size={DIAL_ICON_SIZE.SM} aria-hidden />
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
              icon={<IconThumbUp size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              aria-label={ariaLabels?.likeResponse ?? 'Like response'}
              aria-pressed={activeRating === MessageRating.Like}
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
              icon={<IconThumbDown size={DIAL_ICON_SIZE.SM} aria-hidden />}
              size={ElementSize.Small}
              aria-label={ariaLabels?.dislikeResponse ?? 'Dislike response'}
              aria-pressed={activeRating === MessageRating.Dislike}
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
