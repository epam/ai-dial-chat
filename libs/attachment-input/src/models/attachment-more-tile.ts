import type { ReactNode } from 'react';

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
}
