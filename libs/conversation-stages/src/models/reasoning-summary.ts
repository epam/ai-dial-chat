import type { StageTypography } from './stages-props';

/** Color overrides for the `ReasoningSummary` component applied as CSS custom properties. */
export interface ReasoningSummaryColors {
  /** Color of the toggle button label and icon. Defaults to `--text-secondary`. */
  labelColor?: string;
  /** Color of the toggle button label and icon on hover. Defaults to `--text-primary`. */
  labelHoverColor?: string;
}

/** Combined style overrides (colors and typography) for the `ReasoningSummary` component. */
export interface ReasoningSummaryStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ReasoningSummaryColors;
  /** Typography applied to the toggle label and the rendered summary text. */
  typography?: StageTypography;
}

/** User-visible strings for the `ReasoningSummary` component. */
export interface ReasoningSummaryLabels {
  /** Title shown on the toggle button. Defaults to `'Reasoning summary'`. */
  title?: string;
  /** Accessible label announced when the section is collapsed. Defaults to `'Expand reasoning summary'`. */
  expandAriaLabel?: string;
  /** Accessible label announced when the section is expanded. Defaults to `'Collapse reasoning summary'`. */
  collapseAriaLabel?: string;
  /** Accessible label for the copy button inside the rendered markdown. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
}

/** Props accepted by the `ReasoningSummary` component. */
export interface ReasoningSummaryProps {
  /** Already-normalized, ordered reasoning-summary text to render. */
  text: string;
  /** When `true`, the section defaults to expanded and announces updates via `aria-live`. */
  isStreaming?: boolean;
  /** User-visible strings. */
  labels?: ReasoningSummaryLabels;
  /** Extra class name(s) merged onto the outer wrapper. */
  className?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: ReasoningSummaryStyles;
}
