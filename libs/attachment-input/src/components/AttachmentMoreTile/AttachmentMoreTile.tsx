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
    {/*
     * `<bdi dir="ltr">`, not a bare string: in RTL, the bidi algorithm
     * otherwise reorders "+3" to visually read "3+" (the "+" is a weak
     * character that follows the surrounding paragraph direction unless
     * isolated). This keeps the badge "+3" regardless of page direction.
     */}
    {children ?? <bdi dir="ltr">{`+${count}`}</bdi>}
  </button>
);
