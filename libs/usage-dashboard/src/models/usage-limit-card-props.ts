/** Visual/semantic status of one aggregate cost-limit card, derived by the host from its usage ratio. Every status renders a badge. */
export enum UsageLimitStatus {
  /** Below the running-low threshold. Rendered with the default (blue) accent and a "within limits" badge. */
  Default = 'default',
  /** At or above the running-low threshold but below 100% used. Rendered with the warning (amber) accent and badge. */
  RunningLow = 'runningLow',
  /** At or above 100% used. Rendered with the error (red) accent and badge. */
  LimitReached = 'limitReached',
}

/** One aggregate cost-budget card's fully normalized, preformatted data. The host owns all DTO interpretation, currency formatting, and threshold derivation. */
export interface UsageLimitCardData {
  /** Card title, e.g. `'Today'` / `'This week'` / `'This month'`. */
  title: string;
  /** Accessible description of the rolling window, e.g. `'Last 24 hours'`, appended to the card's accessible group name. */
  periodDescription: string;
  /** Raw used amount, already clamped to `>= 0` by the host. Used only to drive `progressAriaLabel`/text — the library never recomputes it. */
  used: number;
  /** Raw total amount. Ignored when `isUnlimited` is `true`. */
  total: number;
  /** Preformatted used amount, e.g. `'$3.60'`. Always the card's prominent figure. */
  usedLabel: string;
  /** Preformatted total amount, e.g. `'$4.00'`, passed to `labels.usedOfTotalLabel`. Omitted when `isUnlimited` is `true`. */
  totalLabel?: string;
  /** Preformatted remaining amount, e.g. `'$0.40'`, passed to `labels.remainingCaptionLabel`. Omitted when `isUnlimited` is `true`. */
  remainingLabel?: string;
  /** Whether the host detected the unlimited sentinel or an otherwise-unusable total. When `true`, only `usedLabel` is shown — no progress bar, ratio, or badge. */
  isUnlimited?: boolean;
  /** Used percentage, not pre-clamped — may exceed 100. The card clamps both the progress-bar fill and the visible percent label at 100%; only `progressAriaLabel` conveys the real, uncapped value. Ignored when `isUnlimited` is `true`. */
  usedPercent?: number;
  /** Status the host derived from `usedPercent` against its own thresholds. */
  status: UsageLimitStatus;
  /** Accessible value text for the progress bar (`aria-valuetext`), e.g. `'$3.60 of $4.00, 90% used'`. */
  progressAriaLabel: string;
}

/** Localized strings shared by every card in a `UsageLimitCardGroup`/`UsageLimitCard`, independent of any single card's data. */
export interface UsageLimitCardGroupLabels {
  /** Status badge text for `UsageLimitStatus.Default`, e.g. `'Within limits'`. */
  defaultBadgeLabel: string;
  /** Status badge text for `UsageLimitStatus.RunningLow`, e.g. `'Running low'`. */
  runningLowBadgeLabel: string;
  /** Status badge text for `UsageLimitStatus.LimitReached`, e.g. `'Limit reached'`. */
  limitReachedBadgeLabel: string;
  /** Builds the caption next to the prominent used amount, e.g. `({ total }) => \`used of ${total}\`` . Not shown when `isUnlimited` is `true`. */
  usedOfTotalLabel: (params: { total: string }) => string;
  /** Builds the remaining-amount caption below the progress bar, e.g. `({ remaining }) => \`${remaining} left\`` . Not shown when `isUnlimited` is `true`. */
  remainingCaptionLabel: (params: { remaining: string }) => string;
  /** Builds the trailing used-percent label, e.g. `({ percent }) => \`${percent}%\`` . */
  usedPercentLabel: (params: { percent: number }) => string;
}

/** Color overrides for `UsageLimitCardGroup`/`UsageLimitCard`, applied as CSS custom properties. */
export interface UsageLimitCardGroupColors {
  /** Individual card background. Fallback: `--bg-layer-raised`. */
  cardBackground?: string;
  /** Title text color. Fallback: `--text-primary`. */
  titleColor?: string;
  /*
   * Every status splits into a *text* color (amount figure) and a *progress* color (bar fill) —
   * each pair uses the same two design tokens the Figma export uses, and they deliberately
   * differ: the bar's brighter/lighter token reads fine as a decorative fill but would fail text
   * contrast, so the amount figure uses the darker token of the pair instead.
   */
  /** Prominent amount text color in the default status. Fallback: `--text-accent` (`#1D4ED8`). */
  defaultAccentColor?: string;
  /** Progress-fill color in the default status. Fallback: `--text-control-accent-hover` (`#5976E9`). */
  defaultProgressColor?: string;
  /** Prominent amount text color in the running-low status. Fallback: `--text-warning` (`#7F6300`). */
  warningAccentColor?: string;
  /** Progress-fill color in the running-low status. Fallback: `--text-warning-icon` (`#EEC840`). */
  warningProgressColor?: string;
  /** Prominent amount text color in the limit-reached status. Fallback: `--text-error` (`#AE2F2F`). */
  errorAccentColor?: string;
  /** Progress-fill color in the limit-reached status. Fallback: `--bg-control-error-active` (`#CC4545`). */
  errorProgressColor?: string;
  /** Secondary amount/caption text color (the "used of $X.XX" and "$X.XX left" portions). Fallback: `--text-secondary`. */
  secondaryAmountColor?: string;
  /** Progress-bar track color. Fallback: `--bg-layer-sunken`. */
  progressTrackColor?: string;
  /** Default-status badge background. Fallback: `--bg-success` (`#DBF1EB`). */
  defaultBadgeBackground?: string;
  /** Default-status badge text color. Fallback: `--text-success` (`#007274`). */
  defaultBadgeColor?: string;
  /** Running-low badge background. Fallback: `--bg-warning` (`#FAF0CF`). */
  warningBadgeBackground?: string;
  /** Running-low badge text color. Fallback: `--text-warning` (`#7F6300`). */
  warningBadgeColor?: string;
  /** Limit-reached badge background. Fallback: `--bg-error` (`#F3D6D8`). */
  errorBadgeBackground?: string;
  /** Limit-reached badge text color. Fallback: `--text-error` (`#AE2F2F`). */
  errorBadgeColor?: string;
  /** Used-percent trailing label color. Fallback: `--text-secondary`. */
  usedPercentLabelColor?: string;
}

/** Typography class overrides for `UsageLimitCardGroup`/`UsageLimitCard`. */
export interface UsageLimitCardGroupTypography {
  /** CSS class for the card title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class for the prominent used-amount figure. Defaults to `'dial-display1-text'`. */
  amountClassName?: string;
  /** CSS class for the secondary ("used of $X.XX" / "$X.XX left") caption text. Defaults to `'dial-small-text'`. */
  secondaryAmountClassName?: string;
  /** CSS class for the status badge text. Defaults to `'dial-caption-lead-semi-text'`. */
  badgeClassName?: string;
  /** CSS class for the trailing used-percent label. Defaults to `'dial-small-text'`. */
  usedPercentLabelClassName?: string;
}

/** Style overrides accepted by `UsageLimitCardGroup` and `UsageLimitCard`. */
export interface UsageLimitCardGroupStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: UsageLimitCardGroupColors;
  /** Typography class overrides. */
  typography?: UsageLimitCardGroupTypography;
}

/** Props for `UsageLimitCardGroup`. */
export interface UsageLimitCardGroupProps {
  /** Cards to render, in display order (e.g. Today, This week, This month). Each renders as its own independent, equally-sized box. Empty array renders nothing. */
  cards: UsageLimitCardData[];
  /** Localized strings shared by every card. */
  labels: UsageLimitCardGroupLabels;
  /** Style overrides applied as CSS custom properties and typography class overrides. */
  styles?: UsageLimitCardGroupStyles;
}

/** Props for `UsageLimitCard`. */
export interface UsageLimitCardProps {
  /** The card's normalized data. */
  data: UsageLimitCardData;
  /** Localized strings shared by every card. */
  labels: UsageLimitCardGroupLabels;
  /** Style overrides applied as CSS custom properties and typography class overrides. */
  styles?: UsageLimitCardGroupStyles;
}
