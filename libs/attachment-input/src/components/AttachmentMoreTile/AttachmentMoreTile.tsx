import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { AttachmentMoreTileProps } from '../../models/attachment-more-tile';
import styles from './AttachmentMoreTile.module.scss';

/**
 * Square placeholder tile shown in the attachment grid: a "+N" tile when
 * collapsed (activating it expands the group), or — via `children` — a
 * collapse-icon tile in the same tile form for "show less".
 */
export const AttachmentMoreTile: FC<AttachmentMoreTileProps> = ({
  count,
  onClick,
  ariaLabel,
  children,
  fontClassName = 'dial-small-semi-text',
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel ?? `Show ${count} more attachments`}
    className={mergeClasses(
      'flex size-[84px] items-center justify-center rounded-xl border',
      fontClassName,
      styles.tile,
      className,
    )}
  >
    {children ?? <bdi dir="ltr">{`+${count}`}</bdi>}
  </button>
);
