import type { Stage } from '@epam/ai-dial-chat-shared';

/**
 * Typography configuration for stage content text.
 * Use either `fontClassName` (a CSS utility class) or the explicit CSS property fields — not both.
 * When `fontClassName` is provided, the individual CSS-property fields are ignored.
 */
export interface StageTypography {
  /** CSS utility class applied to stage text elements (`p`, `ul`, `ol`). */
  fontClassName?: string;
  /** CSS utility class applied to inline code elements. Defaults to `'font-mono text-sm'`. */
  codeClassName?: string;
  /** Font family applied to the panel root via CSS custom property. */
  fontFamily?: string;
}

/** Color overrides for the `StagesPanel` component applied as CSS custom properties. */
export interface StagesPanelColors {
  /** Background color of the panel surface. */
  background?: string;
  /** Border color of the panel. */
  border?: string;
  /** General text color (header label, count badge). */
  text?: string;
  /**
   * Text color applied to each stage name row.
   * Defaults to the app's `--text-secondary` theme variable (`#9fa6bd`).
   */
  stageTextColor?: string;
  /** Icon / text color for a running stage. */
  runningColor?: string;
  /** Icon / text color for a completed stage. */
  completedColor?: string;
  /** Icon / text color for a failed or errored stage. */
  failedColor?: string;
  /** Background color of the collapsible stage button. Defaults to `transparent`. */
  buttonBackground?: string;
}

/** Combined style overrides (colors and typography) for the `StagesPanel` component. */
export interface StagesPanelStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: StagesPanelColors;
  /** Typography applied to stage content text. Defaults to `{ fontClassName: 'dial-small-text' }`. */
  typography?: StageTypography;
}

/** Props accepted by the `StagesPanel` component. */
export interface StagesPanelProps {
  /** Ordered list of stages to display. */
  stages: Stage[];
  /** When `true` the last stage with `status: null` shows a live spinner. */
  isStreaming: boolean;
  /** Extra class name(s) merged onto the outer wrapper. */
  className?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: StagesPanelStyles;
  /** Accessible label for the copy button on each stage's content. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
}
