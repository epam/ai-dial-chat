import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { AttachmentMoreTileProps } from '../../models/AttachmentMoreTile';
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
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel ?? `Show ${count} more attachments`}
    className={mergeClasses(
      'dial-small-semi-text flex size-[84px] items-center justify-center rounded-xl border',
      styles.tile,
      className,
    )}
  >
    {children ?? <bdi dir="ltr">{`+${count}`}</bdi>}
  </button>
);
