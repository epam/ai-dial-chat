/** One output of a project, as the {@link ProjectOutputs} section renders it. */
export interface ProjectOutputItem {
  /** File name; also the card's id. */
  name: string;
  /** MIME type, used for the card's type icon; empty when unknown. */
  contentType: string;
}

/** Localized labels used by the {@link ProjectOutputs} component. */
export interface ProjectOutputsLabels {
  /** Section heading. Defaults to `'Outputs'`. */
  title?: string;
  /** Label of the action that shows every output, e.g. "See all (9)". Defaults to `` (count) => `See all (${count})` ``. */
  seeAllLabel?: (count: number) => string;
  /** Label of the action that returns to the preview row. Defaults to `'Show less'`. */
  showLessLabel?: string;
  /** Accessible name of an output card, e.g. "Preview report.pdf". Defaults to `` (name) => `Preview ${name}` ``. */
  openOutputLabel?: (name: string) => string;
  /** Shown when the outputs could not be loaded. Defaults to `'Could not load outputs'`. */
  errorLabel?: string;
  /** Retry action label. Defaults to `'Retry'`. */
  retryLabel?: string;
}

/**
 * Color overrides for the {@link ProjectOutputs} component, applied as CSS
 * custom properties with app theme fallbacks.
 */
export interface ProjectOutputsColors {
  /** The section heading. Fallback: `--text-primary`. */
  headingText?: string;
  /** The error text. Fallback: `--text-secondary`. */
  secondaryText?: string;
}

/** Typography overrides for the {@link ProjectOutputs} component. */
export interface ProjectOutputsTypography {
  /** CSS class applied to the section heading. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class applied to the error text. Defaults to `'dial-tiny-text'`. */
  helperClassName?: string;
}

/** Style overrides for the {@link ProjectOutputs} component. */
export interface ProjectOutputsStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ProjectOutputsColors;
  /** Typography class overrides. */
  typography?: ProjectOutputsTypography;
}

/** Props for the {@link ProjectOutputs} component. */
export interface ProjectOutputsProps {
  /** Outputs, in display order. */
  items: ProjectOutputItem[];
  /** Called with a file name when the user activates its card; the host decides what that opens. */
  onOpenOutput: (name: string) => void;
  /** Name of the output whose card renders selected; no card is selected when unset. */
  selectedOutputName?: string;
  /** Shows the error text, and the retry action when `onRetry` is set, instead of the cards; focus moves to the heading when it clears after a retry. Defaults to `false`. */
  hasError?: boolean;
  /** Called from the retry action of the error state; the action is hidden when omitted. */
  onRetry?: () => void;
  /** Number of cards shown before "See all". Defaults to `6`. */
  previewLimit?: number;
  /** Localized labels. */
  labels?: ProjectOutputsLabels;
  /** Color and typography overrides. */
  styles?: ProjectOutputsStyles;
}
