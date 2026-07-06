import { InitialsAvatar, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import {
  type ModelUsagePeriod,
  type UsageModelTableLabels,
  UsageLimitState,
  UsageRowScope,
} from '../../types/usage-limit';
import { DEFAULT_USAGE_STATE_COLORS } from '../../utils/usage-colors';
import {
  formatUsageAmount,
  getModelRowState,
  getUsageLimitState,
  getUsagePercentage,
} from '../../utils/usage-limit';

/** Props for `UsageModelRow`. */
export interface UsageModelRowProps {
  /** Model display name. */
  name: string;
  /** Version suffix shown next to the name. */
  version?: string;
  /** Today's spend and optional cap. */
  today: ModelUsagePeriod;
  /** This month's spend and optional cap. */
  thisMonth: ModelUsagePeriod;
  /** ISO 4217 currency code used to format amounts. */
  currency: string;
  /** Fraction of remaining budget at/below which a period becomes `Warning`. */
  warningThreshold?: number;
  /** Resolved copy for this table. */
  labels: UsageModelTableLabels;
  /** Typography class for the model name. Defaults to `'dial-small-semi-text'`. */
  nameClassName?: string;
  /** Typography class for muted secondary text (version, cap denominator, reset subline, mobile cell labels). Defaults to `'dial-tiny-text text-secondary'`. */
  secondaryTextClassName?: string;
  /** Typography class for usage cell values. Defaults to `'dial-small-semi-text'`. */
  valueClassName?: string;
  /** Typography class for the eyebrow "Model" label above the name. Matches the Catalog browse-card entity-type label style by default. */
  eyebrowClassName?: string;
  /** Typography class for a row's status text when its worse period is `Normal`. Defaults to `'text-secondary'` (muted, not colored — only Warning/Blocked get colored text). */
  normalStatusTextClassName?: string;
  /** Typography class for the status text when neither period has a cap. Defaults to `'text-secondary'`. */
  noCapStatusTextClassName?: string;
}

const renderPeriodCell = (
  period: ModelUsagePeriod,
  currency: string,
  warningThreshold: number | undefined,
  valueClassName: string,
  secondaryTextClassName: string,
  labels: UsageModelTableLabels,
  columnLabel: string,
) => {
  const mobileLabel = (
    <div
      className={mergeClasses(
        'mb-1 block desktop:hidden',
        secondaryTextClassName,
      )}
    >
      {columnLabel}
    </div>
  );

  if (period.limit == null) {
    return (
      <div>
        {mobileLabel}
        <div className={valueClassName}>
          {formatUsageAmount(period.used, currency)}
        </div>
      </div>
    );
  }

  const state = getUsageLimitState(period.used, period.limit, warningThreshold);
  const colors = DEFAULT_USAGE_STATE_COLORS[state];
  const percentage = getUsagePercentage(period.used, period.limit);

  return (
    <div>
      {mobileLabel}
      <div className={valueClassName}>
        {labels.capValueLabel(
          formatUsageAmount(period.used, currency),
          formatUsageAmount(period.limit, currency),
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={period.used}
        aria-valuemin={0}
        aria-valuemax={period.limit}
        aria-label={columnLabel}
        className="mt-1.5 h-1 max-w-[130px] overflow-hidden rounded-full bg-layer-4"
      >
        <div
          className={mergeClasses(
            'h-full rounded-full transition-[width] duration-300',
            colors.fillClassName,
          )}
          style={{
            width: `${percentage}%`,
            backgroundColor: colors.fillClassName
              ? undefined
              : colors.fillColorValue,
          }}
        />
      </div>
    </div>
  );
};

/** One row of `UsageModelTable`: a model tile, today/this-month usage cells, and a status indicator. */
export const UsageModelRow: FC<UsageModelRowProps> = ({
  name,
  version,
  today,
  thisMonth,
  currency,
  warningThreshold,
  labels,
  nameClassName = 'dial-small-semi-text',
  secondaryTextClassName = 'dial-tiny-text text-secondary',
  valueClassName = 'dial-small-semi-text',
  eyebrowClassName = 'dial-caption-text font-semibold uppercase tracking-[0.06em] text-accent-primary',
  normalStatusTextClassName = 'text-secondary',
  noCapStatusTextClassName = 'text-secondary',
}) => {
  const { state, scope } = getModelRowState(
    { today, thisMonth },
    warningThreshold,
  );
  const colors = DEFAULT_USAGE_STATE_COLORS[state];
  const hasCap = scope != null;
  const resetLabel =
    scope === UsageRowScope.Daily ? today.resetLabel : thisMonth.resetLabel;

  const statusLabel =
    state === UsageLimitState.Blocked
      ? labels.capReachedLabel(scope as UsageRowScope)
      : state === UsageLimitState.Warning
        ? labels.nearCapLabel(scope as UsageRowScope)
        : state === UsageLimitState.Normal
          ? labels.withinLimitsLabel
          : labels.noLimitLabel;

  // Only Warning/Blocked color the status text itself; Normal stays muted (the dot alone
  // carries the "OK" green), and the no-cap case gets its own quiet, uncolored tone.
  const isUrgent =
    state === UsageLimitState.Warning || state === UsageLimitState.Blocked;
  const statusTextClassName = !hasCap
    ? noCapStatusTextClassName
    : isUrgent
      ? colors.textClassName
      : normalStatusTextClassName;

  return (
    <div className="grid grid-cols-2 items-start gap-x-4 gap-y-3 border-b border-tertiary px-3 py-4 last:border-b-0 hover:bg-layer-6 desktop:grid-cols-[minmax(200px,1fr)_1fr_1fr_1fr] desktop:gap-4">
      <div className="col-span-2 flex min-w-0 items-center gap-3 desktop:col-span-1">
        <InitialsAvatar
          name={name}
          size={40}
          className="shrink-0 rounded-[11px]"
        />
        <div className="min-w-0">
          <div className={eyebrowClassName}>{labels.modelEyebrowLabel}</div>
          <div className={mergeClasses(nameClassName, 'truncate')}>
            {name}
            {version && (
              <span className={mergeClasses('ms-1', secondaryTextClassName)}>
                {version}
              </span>
            )}
          </div>
        </div>
      </div>

      {renderPeriodCell(
        today,
        currency,
        warningThreshold,
        valueClassName,
        secondaryTextClassName,
        labels,
        labels.todayColumnLabel,
      )}
      {renderPeriodCell(
        thisMonth,
        currency,
        warningThreshold,
        valueClassName,
        secondaryTextClassName,
        labels,
        labels.monthColumnLabel,
      )}

      <div className="col-span-2 flex flex-col items-start gap-1 desktop:col-span-1 desktop:justify-self-start">
        <div
          className={mergeClasses(
            'dial-tiny-semi-text flex items-center gap-2',
            statusTextClassName,
          )}
        >
          {hasCap && (
            <span
              aria-hidden
              className={mergeClasses(
                'size-1.5 shrink-0 rounded-full',
                colors.fillClassName,
              )}
              style={
                colors.fillClassName
                  ? undefined
                  : { backgroundColor: colors.fillColorValue }
              }
            />
          )}
          {statusLabel}
        </div>
        {hasCap && resetLabel && (
          <div className={secondaryTextClassName}>{resetLabel}</div>
        )}
      </div>
    </div>
  );
};
