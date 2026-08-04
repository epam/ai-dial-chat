import type { Stage } from '@epam/ai-dial-chat-shared';

/** Typography class overrides for stage name and expanded content elements in `StagesPanel`. */
export interface StageTypography {
  /** CSS utility class applied to the stage/step name. */
  fontClassName?: string;
  /** CSS utility class applied to expanded content text elements (paragraphs, lists, blockquotes, links, table cells). */
  contentClassName?: string;
  /** CSS utility class applied to `<strong>` (bold markdown) inside expanded content. */
  strongClassName?: string;
  /** CSS utility class applied to every heading level (`h1`–`h6`) inside expanded content. */
  headingClassName?: string;
  /** CSS utility class applied to inline code elements. */
  codeClassName?: string;
  /** CSS utility class applied to count badges (e.g. `×N` collapsed group). */
  countFontClassName?: string;
}

/** CSS custom property color overrides for the `StagesPanel` component. */
export interface StagesPanelColors {
  /** General text color. Defaults to `--text-primary`. */
  text?: string;
  /** Background tint on row hover. Defaults to `--bg-layer-2`. */
  rowHoverColor?: string;
  /** Text color of each stage name. Defaults to `--text-secondary`. */
  stageTextColor?: string;
  /** Text and icon color for a failed stage. Defaults to `--text-warning`. */
  failedColor?: string;
  /** Background color of the collapse button. Defaults to transparent. */
  collapsedButtonBg?: string;
  /** Text color of stage tag labels. Defaults to `--text-tertiary`. */
  tagTextColor?: string;
  /** Text color of the attempt count badge (e.g. `×N`). Defaults to `--text-tertiary`. */
  countTextColor?: string;
  /** Text color of the total-duration label. Defaults to `--text-tertiary`. */
  durationTextColor?: string;
  /** Color of secondary (non-status) icons. Defaults to `--text-secondary` at 70% opacity. */
  iconSecondaryColor?: string;
  /** Color of the completed-check icon. Defaults to `--text-tertiary`. */
  iconCompletedColor?: string;
  /** Color of the error/exception icon. Defaults to `--text-warning`. */
  iconErrorColor?: string;
  /** Background color of fenced code blocks and inline code. Defaults to `--bg-layer-raised`. */
  codeBg?: string;
  /** Border color of fenced code blocks and inline code. Defaults to `--stroke-secondary`. */
  codeBorderColor?: string;
  /** Text color inside code blocks. Defaults to `--text-primary`. */
  codeTextColor?: string;
  /** Border color used for table cells and blockquotes. Defaults to `--stroke-secondary`. */
  borderColor?: string;
}

/** Combined style overrides (colors and typography) for the `StagesPanel` component. */
export interface StagesPanelStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: StagesPanelColors;
  /** Typography applied to the stage name and expanded content. */
  typography?: StageTypography;
}

/** User-visible strings for the `StagesPanel` component. */
export interface StagesPanelLabels {
  /** Accessible label for the copy button on each stage's content. Defaults to `'Copy'`. */
  copyAriaLabel?: string;
  /** Accessible label announced for a running stage's spinner. Defaults to `'Running'`. */
  runningAriaLabel?: string;
  /** Visually-hidden label announced alongside a failed stage's icon. Defaults to `'Failed'`. */
  failedAriaLabel?: string;
  /** Label for a single attempt given its 1-based number. Defaults to `(n) => \`Attempt ${n}\``. */
  attemptLabel?: (attemptNumber: number) => string;
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
  /** User-visible strings. */
  labels?: StagesPanelLabels;
}
