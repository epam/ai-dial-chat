import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import { ATTACHMENT_TILE_BASE_CLASS } from '../../constants/attachment-group';
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
  labels,
  children,
  styles: tileStyles,
}) => {
  const { ariaLabel } = labels ?? {};
  const {
    typography: { fontClassName = 'dial-small-semi-text' } = {},
    className,
    colors,
  } = tileStyles ?? {};
  const cssVars = buildCssVars({
    '--ci-more-tile-bg': colors?.background,
    '--ci-more-tile-border': colors?.border,
    '--ci-more-tile-color': colors?.color,
    '--ci-more-tile-bg-hover': colors?.backgroundHover,
    '--ci-more-tile-color-hover': colors?.colorHover,
    '--ci-more-tile-border-hover': colors?.borderHover,
    '--ci-more-tile-focus-outline': colors?.focusOutline,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `Show ${count} more attachments`}
      style={cssVars}
      className={mergeClasses(
        ATTACHMENT_TILE_BASE_CLASS,
        fontClassName,
        styles.tile,
        className,
      )}
    >
      {children ?? <bdi dir="ltr">{`+${count}`}</bdi>}
    </button>
  );
};
