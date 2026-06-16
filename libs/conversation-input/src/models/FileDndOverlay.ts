/** Props accepted by the `FileDndOverlay` component. */
export interface FileDndOverlayProps {
  /** When `true`, the full-screen overlay is rendered. */
  isVisible: boolean;
  /**
   * When `false`, the overlay renders a denied state: `IconFileX` in error color,
   * `cursor-not-allowed`, and drops are suppressed (not forwarded to the document).
   * Defaults to `true`.
   */
  isAttachmentsAllowed?: boolean;
  /** Title text rendered below the icon. Defaults differ by state: `'Attach files'` when allowed, `'No attachments allowed'` when denied. */
  title?: string;
  /** Subtitle text rendered below the title. Defaults differ by state: `'Drop files here to attach them to message'` when allowed, `"Attachments can't be added to message"` when denied. */
  subtitle?: string;
  /** Tailwind class(es) applied to the icon in the allowed state. Defaults to `'text-accent-primary'`. */
  iconClassName?: string;
  /** Tailwind class(es) applied to the icon in the denied state (`isAttachmentsAllowed={false}`). Defaults to `'text-error'`. */
  deniedIconClassName?: string;
  /** Tailwind class(es) applied to the title. Defaults to `'heading-3'`. */
  titleClassName?: string;
  /** Tailwind class(es) applied to the subtitle. Defaults to `'dial-small-text'`. */
  subtitleClassName?: string;
}
