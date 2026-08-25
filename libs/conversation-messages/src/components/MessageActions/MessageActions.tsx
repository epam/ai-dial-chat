import {
  buildCssVars,
  CopyIconButton,
  mergeClasses,
  MessageRating,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  ElementSize,
  ToggleIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconMarkdown,
  IconPencilMinus,
  IconRefresh,
  IconThumbDown,
  IconThumbDownFilled,
  IconThumbUp,
  IconThumbUpFilled,
  IconTrashX,
} from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';
import type { MessageActionsProps } from '../../models/message-actions';
import styles from './MessageActions.module.scss';

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
  colors,
}) => {
  const { tooltips, ariaLabels } = labels ?? {};
  const [copied, setCopied] = useState<'copy' | 'markdown' | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

  const cssVars = buildCssVars({
    '--ma-active-rating-text': colors?.activeRatingText,
  });

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
      style={cssVars}
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
            <ToggleIconButton
              icon={
                <IconPencilMinus
                  size={DIAL_ICON_SIZE.SM}
                  aria-hidden
                  stroke={1.5}
                />
              }
              size={ElementSize.Small}
              aria-label={ariaLabels?.editMessage ?? 'Edit message'}
              tooltipProps={{ tooltip: tooltips?.edit ?? 'Edit' }}
              onClick={onEdit}
              onMouseEnter={onEditHover}
              onFocus={onEditHover}
            />
          )}
          {onDelete && (
            <ToggleIconButton
              icon={
                <IconTrashX size={DIAL_ICON_SIZE.SM} aria-hidden stroke={1.5} />
              }
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
            <ToggleIconButton
              icon={
                <IconRefresh
                  size={DIAL_ICON_SIZE.SM}
                  aria-hidden
                  stroke={1.5}
                />
              }
              size={ElementSize.Small}
              aria-label={
                ariaLabels?.regenerateResponse ?? 'Regenerate response'
              }
              tooltipProps={{ tooltip: tooltips?.regenerate ?? 'Regenerate' }}
              onClick={onRegenerate}
            />
          )}
          {onCopy && (
            <CopyIconButton
              iconSize={DIAL_ICON_SIZE.SM}
              onClick={handleCopy}
              size={ElementSize.Small}
              isCopied={copied === 'copy'}
              copyLabel={tooltips?.copy ?? 'Copy'}
              copiedLabel={tooltips?.copied ?? 'Copied!'}
              ariaLabel={ariaLabels?.copyResponse ?? 'Copy response'}
            />
          )}
          {onCopyMarkdown && (
            <CopyIconButton
              iconSize={DIAL_ICON_SIZE.SM}
              onClick={handleCopyMarkdown}
              size={ElementSize.Small}
              isCopied={copied === 'markdown'}
              iconCopy={
                <IconMarkdown
                  size={DIAL_ICON_SIZE.SM}
                  aria-hidden
                  stroke={1.5}
                />
              }
              copyLabel={tooltips?.copyMarkdown ?? 'Copy as Markdown'}
              copiedLabel={tooltips?.copiedMarkdown ?? 'Copied!'}
              ariaLabel={ariaLabels?.copyAsMarkdown ?? 'Copy as markdown'}
            />
          )}

          {onLike && (
            <ToggleIconButton
              icon={
                activeRating === MessageRating.Like ? (
                  <IconThumbUpFilled
                    className={styles.activeRating}
                    size={DIAL_ICON_SIZE.SM}
                    stroke={1.5}
                    aria-hidden
                  />
                ) : (
                  <IconThumbUp
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={1.5}
                  />
                )
              }
              size={ElementSize.Small}
              aria-label={ariaLabels?.likeResponse ?? 'Like response'}
              aria-pressed={activeRating === MessageRating.Like}
              tooltipProps={{ tooltip: tooltips?.like ?? 'Like' }}
              onClick={onLike}
            />
          )}
          {onDislike && (
            <ToggleIconButton
              icon={
                activeRating === MessageRating.Dislike ? (
                  <IconThumbDownFilled
                    className={styles.activeRating}
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={1.5}
                  />
                ) : (
                  <IconThumbDown
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={1.5}
                  />
                )
              }
              size={ElementSize.Small}
              aria-label={ariaLabels?.dislikeResponse ?? 'Dislike response'}
              aria-pressed={activeRating === MessageRating.Dislike}
              tooltipProps={{ tooltip: tooltips?.dislike ?? 'Dislike' }}
              onClick={onDislike}
            />
          )}
        </>
      )}
    </div>
  );
};
