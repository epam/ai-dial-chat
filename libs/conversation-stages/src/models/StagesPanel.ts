import type { Stage } from '@epam/ai-dial-chat-shared';

/** CSS custom-property overrides for the `StagesPanel` component. */
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
}

/** Props accepted by the `StagesPanel` component. */
export interface StagesPanelProps {
  /** Ordered list of stages to display. */
  stages: Stage[];
  /** When `true` the last stage with `status: null` shows a live spinner. */
  isStreaming: boolean;
  /** Extra class name(s) merged onto the outer wrapper. */
  className?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: StagesPanelColors;
  /** Typography class applied to the stage content block. Defaults to `'dial-small-text'`. */
  typographyClassName?: string;
  /** Accessible label for the copy button on each stage's content. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
}
