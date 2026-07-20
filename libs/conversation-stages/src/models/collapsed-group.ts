import type { Stage } from '@epam/ai-dial-chat-shared';

/** Color overrides for the `CollapsedGroup` component applied as CSS custom properties. */
export interface CollapsedGroupColors {
  /** Color of the toggle button label and icon. Defaults to `var(--text-secondary, #575F73)`. */
  labelColor?: string;
  /** Color of the toggle button label and icon on hover. Defaults to `var(--text-primary, #161B2D)`. */
  labelHoverColor?: string;
  /** Color of the execution time. Defaults to `var(--text-tertiary, #808898)` — muted, matching the row-level duration's tone. */
  stepsCountColor?: string;
  /** Color of the leading check icon in the finished-and-successful summary. Defaults to `var(--text-success, #007274)`. */
  doneColor?: string;
  /** Color of the "N failed" text in the failed summary. Defaults to `var(--text-warning, #7f6300)`. */
  failedColor?: string;
}

/** Typography configuration for the toggle button label text. */
export interface CollapsedGroupTypography {
  /** CSS utility class applied to the toggle button label. Defaults to `'dial-small-text'` — matches the size of the step rows it summarizes, since a group header should never render smaller than its contents. */
  fontClassName?: string;
  /** Font family applied to the panel root via CSS custom property. */
  fontFamily?: string;
}

/** Combined style overrides (colors and typography) for the `CollapsedGroup` component. */
export interface CollapsedGroupStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: CollapsedGroupColors;
  /** Typography for the toggle button label. Defaults to `{ fontClassName: 'dial-small-text' }`. */
  typography?: CollapsedGroupTypography;
}

/** User-visible strings for the `CollapsedGroup` component. */
export interface CollapsedGroupLabels {
  /** Label shown before the steps count on the toggle button. Defaults to `'Executed'`. */
  executedLabel?: string;
  /** Returns the pluralized label for the steps count. Receives the count so callers can handle any plural rule. Defaults to `() => 'steps'`. */
  stepsLabel?: (count: number) => string;
  /** Returns the "N failed" fragment shown in the failed summary. Defaults to `(n) => \`${n} failed\``. */
  failedCountLabel?: (failedCount: number) => string;
  /** Returns the "Step X of Y" fragment shown in the running summary. Defaults to `(current, total) => \`Step ${current} of ${total}\``. */
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
  /**
   * Whether the run is still streaming. Drives the summary line's state
   * (running vs. finished vs. failed) and its default open/closed state —
   * expanded while running, collapsed once finished.
   */
  isStreaming: boolean;
  /** User-visible strings for the toggle button. */
  labels?: CollapsedGroupLabels;
  /** Extra class name(s) merged onto the outer wrapper. */
  className?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: CollapsedGroupStyles;
}
