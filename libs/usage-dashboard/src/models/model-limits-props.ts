/** Overall or per-metric severity of a model's limit usage, derived by the host from its usage ratio. */
export enum ModelLimitStatus {
  /** Below the running-low threshold. Rendered with the default (blue) accent and a "within limits" badge. */
  WithinLimits = 'within-limits',
  /** At or above the running-low threshold but below 100% used. Rendered with the warning (amber) accent and badge. */
  RunningLow = 'running-low',
  /** At or above 100% used. Rendered with the error (red) accent and badge. */
  LimitReached = 'limit-reached',
  /** Every supported metric on the row is unlimited. Rendered with a dedicated "No limit" badge. */
  NoLimit = 'no-limit',
  /** No usable (finite or unlimited) metric exists on the row. Rendered with a dedicated "Unavailable" badge. */
  Unavailable = 'unavailable',
}

/** Which of the three normalized shapes a `ModelLimitMetricCell` carries. */
export enum ModelLimitMetricKind {
  /** A usable total exists — renders `used / total` with a progress bar. */
  Finite = 'finite',
  /** The host detected the unlimited sentinel; the renderer decides whether its metric shows supporting limit text. */
  Unlimited = 'unlimited',
  /** The metric could not be determined — renders an explicit unavailable state, no progress bar. */
  Unavailable = 'unavailable',
}

/** One normalized, preformatted Cost or Tokens value for one `ModelLimitRow`. */
export interface ModelLimitMetricCell {
  /** Which of the three rendering shapes this cell uses. */
  kind: ModelLimitMetricKind;
  /** Preformatted used amount, e.g. `'12,345'` or `'$3.60'`. Present for `Finite`/`Unlimited`. */
  usedLabel?: string;
  /** Preformatted total amount, e.g. `'50,000'`. Present for `Finite` only. */
  totalLabel?: string;
  /** Used percentage, not pre-clamped — may exceed 100. Present for `Finite` only; the cell clamps the visual progress fill at 100%, while `ariaLabel` conveys the real value. */
  usedPercent?: number;
  /** Status derived from `usedPercent` against the host's thresholds. Present for `Finite` only. */
  status?: ModelLimitStatus;
  /** Host-provided secondary text for an `Unlimited` metric, e.g. `'Follows cost limit'` or `'No limit'`. */
  supportingLabel?: string;
  /** Accessible text describing the cell's full value, present regardless of `kind` (e.g. `'12,345 of 50,000 tokens used'` or `'Not available'`). */
  ariaLabel: string;
}

/** Normalized overall Cost status and optional explanatory tooltip for one period header. */
export interface ModelLimitPeriodStatus {
  /** Host-derived status of the matching overall Cost limit. */
  status: ModelLimitStatus;
  /** Complete tooltip/accessibility text for warning and error indicators. */
  tooltipLabel?: string;
}

/** Overall Cost statuses aligned with the three fixed comparison periods. */
export interface ModelLimitPeriodStatuses {
  last24Hours: ModelLimitPeriodStatus;
  last7Days: ModelLimitPeriodStatus;
  last30Days: ModelLimitPeriodStatus;
}

/** Preformatted Cost and Tokens values for one rolling-period column. */
export interface ModelLimitPeriodCell {
  /** Tokens usage and limit for the period. */
  tokens: ModelLimitMetricCell;
  /** Attributed cost for the period. */
  cost: ModelLimitMetricCell;
}

/** One row of the Model tokens limits table: model identity, three rolling-period comparisons, and overall status. */
export interface ModelLimitRow {
  /** Stable identifier for the row, e.g. the deployment ID. */
  id: string;
  /** Display name of the model. */
  name: string;
  /** Display version of the model, when known. */
  version?: string;
  /** Image URL for the model's avatar. When absent, an initials-based fallback derived from `name` is shown. */
  avatarSrc?: string;
  /** Cost and Tokens metrics for the rolling 24-hour period. */
  last24Hours: ModelLimitPeriodCell;
  /** Cost and Tokens metrics for the rolling 7-day period. */
  last7Days: ModelLimitPeriodCell;
  /** Cost and Tokens metrics for the rolling 30-day period. */
  last30Days: ModelLimitPeriodCell;
  /** Host-derived overall status across all model-token and overall Cost limit periods. */
  status: ModelLimitStatus;
}

/** Localized strings shared by every row and by the section shell in `ModelLimitsSection`. */
export interface ModelLimitsLabels {
  /** Section heading text, e.g. `'Model tokens limits'`. The row count is rendered separately. */
  headingLabel: string;
  /** Column header text for the Item (identity) column. */
  itemColumnLabel: string;
  /** Column header text for the rolling 24-hour period. */
  last24HoursColumnLabel: string;
  /** Column header text for the rolling 7-day period. */
  last7DaysColumnLabel: string;
  /** Column header text for the rolling 30-day period. */
  last30DaysColumnLabel: string;
  /** Column header text for the Status column. */
  statusColumnLabel: string;
  /** Non-visual accessible label for Tokens values inside every period cell. */
  tokensLabel: string;
  /** Non-visual accessible label for the value-only Cost amount in every period cell. */
  costLabel: string;
  /** Entity type shown above each model name. */
  modelTypeLabel: string;
  /** Text shown after an unlimited Tokens value, e.g. `'No limit'`. */
  noLimitLabel: string;
  /** Text shown in place of a value when the metric is unavailable, e.g. `'Not available'`. Must read as distinct from `noLimitLabel`. */
  unavailableLabel: string;
  /** Status badge text for `ModelLimitStatus.WithinLimits`. */
  withinLimitsBadgeLabel: string;
  /** Status badge text for `ModelLimitStatus.RunningLow`. */
  runningLowBadgeLabel: string;
  /** Status badge text for `ModelLimitStatus.LimitReached`. */
  limitReachedBadgeLabel: string;
  /** Status badge text for `ModelLimitStatus.NoLimit`. */
  noLimitBadgeLabel: string;
  /** Status badge text for `ModelLimitStatus.Unavailable`. */
  unavailableBadgeLabel: string;
  /** Message shown in place of the table when `rows` is empty, e.g. `'No models to show yet.'`. */
  emptyStateLabel: string;
}

/** Color overrides for `ModelLimitsSection`, applied as CSS custom properties. */
export interface ModelLimitsColors {
  /** Section container background. Fallback: `--bg-layer-raised`. */
  containerBackground?: string;
  /** Heading text color. Fallback: `--text-primary`. */
  headingColor?: string;
  /** Heading count color. Fallback: `--text-tertiary`. */
  headingCountColor?: string;
  /** Column header text color. Fallback: `--text-secondary`. */
  columnHeaderColor?: string;
  /** Row divider color. Fallback: `--stroke-secondary`. */
  rowDividerColor?: string;
  /** Model name text color. Fallback: `--text-primary`. */
  nameColor?: string;
  /** Model entity-type text color. Fallback: `--text-accent`. */
  modelTypeColor?: string;
  /** Model version text color. Fallback: `--text-secondary`. */
  versionColor?: string;
  /** Metric prominent used-value text color. Fallback: `--text-primary`. */
  valueColor?: string;
  /** Secondary metric text color (the "used of X" caption). Fallback: `--text-secondary`. */
  secondaryValueColor?: string;
  /** Progress-bar track color. Fallback: `--bg-layer-sunken`. */
  progressTrackColor?: string;
  /** Progress-fill / accent color for `WithinLimits`. Fallback: `--text-control-accent-hover`. */
  defaultProgressColor?: string;
  /** Progress-fill / accent color for `RunningLow`. Fallback: `--text-warning-icon`. */
  warningProgressColor?: string;
  /** Progress-fill / accent color for `LimitReached`. Fallback: `--bg-control-error-active`. */
  errorProgressColor?: string;
  /** Period-header indicator color for `RunningLow`. Fallback: `--text-warning-icon`. */
  warningIndicatorColor?: string;
  /** Period-header indicator color for `LimitReached`. Fallback: `--text-error`. */
  errorIndicatorColor?: string;
  /** `WithinLimits` badge background. Fallback: `--bg-success`. */
  defaultBadgeBackground?: string;
  /** `WithinLimits` badge text color. Fallback: `--text-success`. */
  defaultBadgeColor?: string;
  /** `RunningLow` badge background. Fallback: `--bg-warning`. */
  warningBadgeBackground?: string;
  /** `RunningLow` badge text color. Fallback: `--text-warning`. */
  warningBadgeColor?: string;
  /** `LimitReached` badge background. Fallback: `--bg-error`. */
  errorBadgeBackground?: string;
  /** `LimitReached` badge text color. Fallback: `--text-error`. */
  errorBadgeColor?: string;
  /** `NoLimit`/`Unavailable` status text color. Fallback: `--text-secondary`. */
  neutralBadgeColor?: string;
}

/** Typography class overrides for `ModelLimitsSection`. */
export interface ModelLimitsTypography {
  /** CSS class for the section heading. Defaults to `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** CSS class for the count next to the section heading. Defaults to `'dial-tiny-semi-text'`. */
  headingCountClassName?: string;
  /** CSS class for column headers. Defaults to `'dial-caption-lead-semi-text'`. */
  columnHeaderClassName?: string;
  /** CSS class for the model name. Defaults to `'dial-small-semi-text'`. */
  nameClassName?: string;
  /** CSS class for the model entity type. Defaults to `'dial-caption-lead-semi-text'`. */
  modelTypeClassName?: string;
  /** CSS class for the model version. Defaults to `'dial-small-text'`. */
  versionClassName?: string;
  /** CSS class for a metric's prominent used value. Defaults to `'dial-small-text'`. */
  valueClassName?: string;
  /** CSS class for a metric's secondary caption (total / "No limit" / "Not available"). Defaults to `'dial-tiny-text'`. */
  secondaryValueClassName?: string;
  /** CSS class for status badge text. Defaults to `'dial-caption-lead-semi-text'`. */
  badgeClassName?: string;
}

/** Style overrides accepted by `ModelLimitsSection`. */
export interface ModelLimitsStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ModelLimitsColors;
  /** Typography class overrides. */
  typography?: ModelLimitsTypography;
}

/** Props for `ModelLimitsSection`. */
export interface ModelLimitsSectionProps {
  /** Rows to render, in display order. Each renders as one table row. */
  rows: ModelLimitRow[];
  /** Localized strings shared by the section shell and every row. */
  labels: ModelLimitsLabels;
  /** Host-derived overall Cost statuses/tooltips for the three fixed period headers. */
  periodStatuses: ModelLimitPeriodStatuses;
  /** Style overrides applied as CSS custom properties and typography class overrides. */
  styles?: ModelLimitsStyles;
  /** Size (px) of the empty-state icon, shown when `rows` is empty. Defaults to `48`. */
  emptyStateIconSize?: number;
}
