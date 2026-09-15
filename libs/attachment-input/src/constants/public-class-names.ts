/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the attachment tray and its tiles through these instead of
 * hashed CSS-module locals, DOM order, or ARIA attributes. In particular the
 * tray's `aria-label` is localisable through `labels.ariaLabel`, so it must
 * never be used as a selector. These classes carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const ATTACHMENT_INPUT_CLASS = {
  /** The tray's `role="list"` root. */
  tray: 'dial-ai-attachment-tray',
  /** Each `role="listitem"` wrapper inside the tray. */
  trayItem: 'dial-ai-attachment-tray-item',
  /** The square tile element, for both image and non-previewable attachments. */
  tile: 'dial-ai-attachment-tile',
  /** The tile when selected, additive to `tile`. */
  tileSelected: 'dial-ai-attachment-tile-selected',
  /** The tile's filename element. */
  tileName: 'dial-ai-attachment-tile-name',
  /** The tile's type and size row. */
  tileType: 'dial-ai-attachment-tile-type',
  /** Every corner action button: download, retry, open-link, remove. */
  tileAction: 'dial-ai-attachment-tile-action',
} as const;
