import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import { ATTACHMENT_TILE_BASE_CLASS } from '../../constants/attachment-group';
import type { AttachmentMoreTileProps } from '../../models/attachment-more-tile';
import styles from './AttachmentMoreTile.module.scss';

/** Square placeholder tile shown in the attachment grid: a "+N" overflow tile when collapsed, or a collapse-icon tile when expanded. */
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
    '--ai-more-tile-bg': colors?.background,
    '--ai-more-tile-border': colors?.border,
    '--ai-more-tile-color': colors?.color,
    '--ai-more-tile-bg-hover': colors?.backgroundHover,
    '--ai-more-tile-color-hover': colors?.colorHover,
    '--ai-more-tile-border-hover': colors?.borderHover,
    '--ai-more-tile-focus-outline': colors?.focusOutline,
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
