/** Props accepted by the `FileDndOverlay` component. */
export interface FileDndOverlayProps {
  /** When `true`, the full-screen overlay is rendered. */
  isVisible: boolean;
  /** Title text rendered below the icon. Defaults to `'Attach files'`. */
  title?: string;
  /** Subtitle text rendered below the title. Defaults to `'Drop files here to attach them to message'`. */
  subtitle?: string;
  /** Tailwind class(es) applied to the icon. Defaults to `'text-accent-primary'`. */
  iconClassName?: string;
  /** Tailwind class(es) applied to the title. Defaults to `'heading-3'`. */
  titleClassName?: string;
  /** Tailwind class(es) applied to the subtitle. Defaults to `'dial-small-text'`. */
  subtitleClassName?: string;
}
