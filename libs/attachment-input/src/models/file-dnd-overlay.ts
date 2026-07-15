/** CSS custom-property overrides for the `FileDndOverlay` component. */
export interface FileDndOverlayColors {
  /** Overlay background color. */
  background?: string;
  /** Icon color in the allowed state. */
  icon?: string;
  /** Icon color in the denied state (`isAttachmentsAllowed={false}`). */
  deniedIcon?: string;
}

/** Typography overrides for the `FileDndOverlay` component. */
export interface FileDndOverlayTypography {
  /** CSS class applied to the title. Defaults to `'heading-3 font-semibold'`. */
  titleClassName?: string;
  /** CSS class applied to the subtitle. Defaults to `'dial-small-text'`. */
  subtitleClassName?: string;
}

/** Style overrides for the `FileDndOverlay` component. */
export interface FileDndOverlayStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: FileDndOverlayColors;
  /** Typography overrides applied to the title and subtitle. */
  typography?: FileDndOverlayTypography;
}

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
  /** Style overrides for the icon, title, and subtitle. */
  styles?: FileDndOverlayStyles;
}
