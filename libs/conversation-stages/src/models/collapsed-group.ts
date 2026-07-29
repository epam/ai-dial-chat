import type { Stage } from '@epam/ai-dial-chat-shared';
import type { StagesPanelColors } from './stages-props';

/** Color overrides for the `CollapsedGroup` component applied as CSS custom properties. */
export interface CollapsedGroupColors {
  /** Color of the toggle button label and icon. */
  labelColor?: string;
  /** Color of the toggle button label and icon on hover. */
  labelHoverColor?: string;
  /** Color of the execution time. */
  stepsCountColor?: string;
  /** Color of the leading check icon in the finished-and-successful summary. */
  doneColor?: string;
  /** Color of the "N failed" text in the failed summary. */
  failedColor?: string;
}

/** Typography configuration for the toggle button label text. */
export interface CollapsedGroupTypography {
  /** CSS utility class applied to the toggle button label. */
  fontClassName?: string;
}

/** Combined style overrides (colors and typography) for the `CollapsedGroup` component. */
export interface CollapsedGroupStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: CollapsedGroupColors;
  /** Typography for the toggle button label. */
  typography?: CollapsedGroupTypography;
  /** Color overrides forwarded to the inner `StagesPanel`. */
  panel?: StagesPanelColors;
}

/** User-visible strings for the `CollapsedGroup` component. */
export interface CollapsedGroupLabels {
  /** Label shown before the steps count on the toggle button. Defaults to `'Executed'`. */
  executedLabel?: string;
  /** Returns the pluralized steps label. Defaults to `() => 'steps'`. */
  stepsLabel?: (count: number) => string;
  /** Returns the "N failed" text in the failed summary. Defaults to `(n) => \`${n} failed\``. */
  failedCountLabel?: (failedCount: number) => string;
  /** Returns the "Step X of Y" text in the running summary. Defaults to `(current, total) => \`Step ${current} of ${total}\``. */
  runningStepLabel?: (current: number, total: number) => string;
  /** Accessible label announced for the running summary's spinner. Defaults to `'Running'`. */
  runningAriaLabel?: string;
  /** Accessible label for the copy button on each stage's content. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
  /** Visually-hidden label announced alongside a failed stage's icon. Defaults to `'Failed'`. */
  failedAriaLabel?: string;
  /** Returns the label for a single attempt inside a collapsed `×N` group. Defaults to `(n) => \`Attempt ${n}\``. */
  attemptLabel?: (attemptNumber: number) => string;
}

/** Props accepted by the `CollapsedGroup` component. */
export interface CollapsedGroupProps {
  /** Ordered list of stages to display. */
  stages: Stage[];
  /** When true, expands to a live progress line; collapses to a summary once streaming ends. */
  isStreaming: boolean;
  /** User-visible strings for the toggle button. */
  labels?: CollapsedGroupLabels;
  /** Extra class name(s) merged onto the outer wrapper. */
  className?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: CollapsedGroupStyles;
}
