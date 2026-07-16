import type { ReactNode } from 'react';

/** CSS custom-property overrides for the `AttachmentMoreTile` component. */
export interface AttachmentMoreTileColors {
  /** Tile background color in the default state. */
  background?: string;
  /** Tile border color in the default state. */
  border?: string;
  /** Tile text/icon color in the default state. */
  color?: string;
  /** Tile background color on hover. */
  backgroundHover?: string;
  /** Tile text/icon color on hover. */
  colorHover?: string;
  /** Tile border color on hover. */
  borderHover?: string;
  /** Tile focus outline color. */
  focusOutline?: string;
}

/** Props accepted by the `AttachmentMoreTile` component. */
export interface AttachmentMoreTileProps {
  /** Number of additional, not-yet-visible attachments. Only used for the default `"+N"` content/label. */
  count: number;
  /** Called when the tile is activated (expands or collapses the group). */
  onClick: () => void;
  /**
   * Accessible label. Defaults to `'Show {count} more attachments'`; pass an
   * explicit label (e.g. `'Show less'`) when overriding `children`.
   */
  ariaLabel?: string;
  /** Overrides the default `"+N"` content, e.g. a collapse icon for the "show less" placeholder tile. */
  children?: ReactNode;
  /** Typography class applied to the tile's text/icon content. Defaults to `'dial-small-semi-text'`. */
  fontClassName?: string;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: AttachmentMoreTileColors;
}
