import type { Stage } from '@epam/ai-dial-chat-shared';

/**
 * Typography configuration for a stage row. The name is always the
 * dominant text in the row — bigger than the expanded content — so
 * `fontClassName` (name) and `contentClassName` (expanded markdown content)
 * are deliberately separate fields, not one shared class.
 */
export interface StageTypography {
  /** CSS utility class applied to the stage/step name. Defaults to `'dial-small-text'` (14px, normal weight). */
  fontClassName?: string;
  /** CSS utility class applied to expanded stage content text elements (`p`, `ul`, `ol`, `blockquote`, `a`, table cells) — always smaller than the name. Defaults to `'dial-tiny-text'`, the DS's second-smallest text style (12px), with its line-height forced to 150% for readability. */
  contentClassName?: string;
  /** CSS utility class applied to `<strong>` (bold markdown) inside expanded content. Defaults to `contentClassName` — i.e. no extra weight — so bold markdown in tool/stage output doesn't out-emphasize the quiet, secondary tone of the rest of the content. Pass e.g. `'font-semibold'` to restore emphasis. */
  strongClassName?: string;
  /** CSS utility class applied to every heading level (`h1`–`h6`) inside expanded content. Defaults to `'dial-small-semi-text'` (14px, semibold) — headings inside a stage's content stay uniformly small rather than scaling up to the DS's larger heading sizes. */
  headingClassName?: string;
  /** CSS utility class applied to inline code elements. Defaults to `'rounded-md font-mono text-sm'`. */
  codeClassName?: string;
  /** Font family applied to the panel root via CSS custom property. */
  fontFamily?: string;
  /** CSS utility class applied to count badges (e.g. `×N` collapsed group). Defaults to `'dial-tiny-text'`. */
  countFontClassName?: string;
}

/**
 * Color overrides for the `StagesPanel` component applied as CSS custom
 * properties. The panel is an inline list (no card/border), so these only
 * cover the row-level surface: per-row hover tint and text tones.
 */
export interface StagesPanelColors {
  /** General text color. */
  text?: string;
  /** Background tint on row hover. Defaults to `--bg-layer-2`. */
  rowHoverColor?: string;
  /**
   * Text color applied to each stage name row.
   * Defaults to the app's `--text-secondary` theme variable (`#9fa6bd`).
   */
  stageTextColor?: string;
  /** Icon / text color for a failed or errored stage — the one exception that keeps a saturated color. */
  failedColor?: string;
}

/** Combined style overrides (colors and typography) for the `StagesPanel` component. */
export interface StagesPanelStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: StagesPanelColors;
  /** Typography applied to the stage name and expanded content. Defaults to `{ fontClassName: 'dial-small-text', contentClassName: 'dial-tiny-text' }`. */
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
  /** Returns the label for a single attempt inside a collapsed `×N` group, given its 1-based attempt number. Defaults to `(n) => \`Attempt ${n}\``. */
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
