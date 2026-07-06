/** Account-level usage/budget status derived from `used` vs `limit`. */
export enum UsageLimitState {
  /** Remaining budget is above the warning threshold. */
  Normal = 'normal',
  /** Remaining budget is at or below the warning threshold. */
  Warning = 'warning',
  /** Usage has reached or exceeded the limit. */
  Blocked = 'blocked',
  /** No limit is configured for this scope. */
  Unlimited = 'unlimited',
}

/** Which capped scope a model row's displayed status was derived from. */
export enum UsageRowScope {
  Daily = 'daily',
  Monthly = 'monthly',
}

/** Colors applied to a meter/text/dot for one `UsageLimitState`. Provide either the `*ClassName`
 * fields (existing Tailwind utilities) or `colorValue` (a raw CSS `var()` expression, applied via
 * inline style) for DS tokens with no matching utility class.
 *
 * `textClassName` must always resolve to a token that passes WCAG AA (≥4.5:1) as text — it is
 * never a decorative-only color. `fillClassName`/`fillColorValue` are for the meter/dot fill,
 * which is decorative (paired with the AA-safe text) and does not carry the 4.5:1 requirement. */
export interface UsageLimitStateColors {
  /** Class applied to the colored text (amount, status label). Always AA-safe as text. */
  textClassName: string;
  /** Class applied to the meter/dot fill background. */
  fillClassName?: string;
  /** Raw CSS color (or `var(--token, fallback)` expression) for the fill, used via inline style when `fillClassName` is omitted. */
  fillColorValue?: string;
}

/** One usage/budget window (e.g. daily or monthly) shown in the summary card. */
export interface UsageWindowData {
  /** Window title, e.g. `'Daily limit'`. */
  title: string;
  /** Scope shown under the title, e.g. `'All models'`. */
  scope: string;
  /** Amount already spent this window, in `currency`. */
  used: number;
  /** Budget for this window. `null` means no limit is configured. */
  limit: number | null;
  /** Pre-formatted reset line, e.g. `'Resets 00:00 · in 6h 12m'`. */
  resetLabel: string;
}

/** Spend and (optional) cap for one scope (daily or monthly) of a single model row. */
export interface ModelUsagePeriod {
  /** Amount spent this period, in `currency`. */
  used: number;
  /** Cap for this period. `null` means no limit is configured (spend still rolls up to totals). */
  limit: number | null;
  /** Pre-formatted reset line shown only when `limit` is set, e.g. `'Resets in 4h'`. */
  resetLabel?: string;
}

/** One row of the by-model usage table. */
export interface ModelUsageRowData {
  /** Stable identifier for the row (e.g. deployment id). */
  id: string;
  /** Model display name, e.g. `'Claude Opus'`. */
  name: string;
  /** Version suffix shown next to the name, e.g. `'4.8'`. */
  version?: string;
  /** Today's (daily) spend and optional cap. */
  today: ModelUsagePeriod;
  /** This month's (monthly) spend and optional cap. */
  thisMonth: ModelUsagePeriod;
}

/** All user-visible strings rendered by `UsageSummaryCard`. English defaults — the consuming app supplies translations. */
export interface UsageSummaryCardLabels {
  /** Suffix appended after the formatted remaining/zero amount, e.g. `'left of'`. */
  leftOfLabel: string;
  /** Label on the pill shown when a window is in the `Warning` state, e.g. `'Running low'`. */
  runningLowLabel: string;
  /** Label on the pill shown when a window is in the `Blocked` state, e.g. `'Limit reached'`. */
  limitReachedLabel: string;
  /** Heading shown instead of the figure/meter when a window has no limit. */
  unlimitedHeading: string;
  /** Computes the muted "`X`% used" caption from a rounded percentage. */
  percentUsedLabel: (percent: number) => string;
}

/** All user-visible strings rendered by `UsageModelTable`. English defaults — the consuming app supplies translations. */
export interface UsageModelTableLabels {
  /** "Model" column header. */
  modelColumnLabel: string;
  /** "Today" column header. */
  todayColumnLabel: string;
  /** "This month" column header. */
  monthColumnLabel: string;
  /** "Status" column header. */
  statusColumnLabel: string;
  /** Eyebrow label shown above each model's name, e.g. `'Model'`. */
  modelEyebrowLabel: string;
  /** Computes the "`used` / `limit`" cell text from formatted amounts. */
  capValueLabel: (formattedUsed: string, formattedLimit: string) => string;
  /** Status text for a row whose worse scope is `Blocked`, given which scope it came from. */
  capReachedLabel: (scope: UsageRowScope) => string;
  /** Status text for a row whose worse scope is `Warning`, given which scope it came from. */
  nearCapLabel: (scope: UsageRowScope) => string;
  /** Status text for a row whose worse scope is `Normal`. */
  withinLimitsLabel: string;
  /** Status text for a row with no cap on either scope. */
  noLimitLabel: string;
  /** Title shown when there are no rows to display. */
  emptyTitle: string;
  /** Description shown under the empty-state title. */
  emptyDescription: string;
}
