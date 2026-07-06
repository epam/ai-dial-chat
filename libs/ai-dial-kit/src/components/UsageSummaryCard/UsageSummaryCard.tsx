import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconClock } from '@tabler/icons-react';
import { type FC } from 'react';
import {
  type UsageSummaryCardLabels,
  type UsageWindowData,
  UsageLimitState,
} from '../../types/usage-limit';
import { DEFAULT_USAGE_STATE_COLORS } from '../../utils/usage-colors';
import {
  formatUsageAmount,
  getUsageLimitState,
  getUsagePercentage,
} from '../../utils/usage-limit';

/** English default copy for `UsageSummaryCard`. The consuming app overrides these with translated strings. */
const DEFAULT_LABELS: UsageSummaryCardLabels = {
  leftOfLabel: 'left of',
  runningLowLabel: 'Running low',
  limitReachedLabel: 'Limit reached',
  unlimitedHeading: 'No limit set',
  percentUsedLabel: (percent) => `${percent}% used`,
};

/** Props for `UsageSummaryCard`. */
export interface UsageSummaryCardProps {
  /** The windows to render side by side (e.g. daily + monthly). */
  windows: UsageWindowData[];
  /** ISO 4217 currency code used to format amounts. Defaults to `'USD'`. */
  currency?: string;
  /** Fraction of remaining budget at/below which a window becomes `Warning`. Defaults to `0.15` (85% used). */
  warningThreshold?: number;
  /** Extra classes applied to the card's root element. */
  className?: string;
  /** Typography class for window titles and the unlimited heading. Defaults to `'dial-h3-text'`. */
  titleClassName?: string;
  /** Typography class for muted secondary text (scope, figure suffix, reset line, percentage). Defaults to `'dial-tiny-text text-secondary'`. */
  secondaryTextClassName?: string;
  /** Typography class for the headline figure amount. Defaults to `'dial-display1-text'`. */
  figureClassName?: string;
  /** Classes for the pill shown when a window is `Warning`. Defaults to amber DS tokens. */
  warningPillClassName?: string;
  /** Classes for the pill shown when a window is `Blocked`. Defaults to red DS tokens. */
  blockedPillClassName?: string;
  /** User-visible copy overrides. Merged over English defaults — pass translated strings here. */
  labels?: Partial<UsageSummaryCardLabels>;
}

/**
 * Account-level usage summary card. Renders one panel per window (e.g. daily/monthly limit)
 * with a title, remaining-amount figure, meter, percentage used, reset line, and a state pill
 * once a window is running low or fully used.
 */
export const UsageSummaryCard: FC<UsageSummaryCardProps> = ({
  windows,
  currency = 'USD',
  warningThreshold,
  className,
  titleClassName = 'dial-h3-text',
  secondaryTextClassName = 'dial-tiny-text text-secondary',
  figureClassName = 'dial-display1-text',
  warningPillClassName = 'border-warning bg-warning text-warning',
  blockedPillClassName = 'border-error bg-error text-error',
  labels,
}) => {
  const text = { ...DEFAULT_LABELS, ...labels };

  return (
    <div
      className={mergeClasses(
        'grid grid-cols-1 divide-y divide-tertiary overflow-hidden rounded-[20px] border border-tertiary bg-layer-0 desktop:grid-cols-2 desktop:divide-x desktop:divide-y-0',
        className,
      )}
      // Matches the Catalog browse-card shadow exactly (`CardGrid.module.scss` `.card`) — a
      // two-layer shadow with commas inside `rgba()`, which this app's Tailwind setup does not
      // reliably turn into CSS when expressed as an arbitrary-value class.
      style={{
        boxShadow:
          '0 1px 3px rgba(16, 24, 40, 0.04), 0 6px 20px rgba(16, 24, 40, 0.05)',
      }}
    >
      {windows.map((window) => {
        const state = getUsageLimitState(
          window.used,
          window.limit,
          warningThreshold,
        );
        const colors = DEFAULT_USAGE_STATE_COLORS[state];
        const percentage = getUsagePercentage(window.used, window.limit);
        const remaining =
          window.limit == null ? null : Math.max(0, window.limit - window.used);
        const showPill =
          state === UsageLimitState.Warning ||
          state === UsageLimitState.Blocked;

        return (
          <div key={window.title} className="flex flex-col gap-4 p-[22px]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className={titleClassName}>{window.title}</div>
                <div className={secondaryTextClassName}>{window.scope}</div>
              </div>
              {showPill && (
                <span
                  className={mergeClasses(
                    'dial-tiny-semi-text shrink-0 whitespace-nowrap rounded-full border px-2 py-1',
                    state === UsageLimitState.Blocked
                      ? blockedPillClassName
                      : warningPillClassName,
                  )}
                >
                  {state === UsageLimitState.Blocked
                    ? text.limitReachedLabel
                    : text.runningLowLabel}
                </span>
              )}
            </div>

            {state === UsageLimitState.Unlimited ? (
              <div className={titleClassName}>{text.unlimitedHeading}</div>
            ) : (
              <>
                <div
                  className={mergeClasses(
                    figureClassName,
                    colors.textClassName,
                  )}
                >
                  {formatUsageAmount(
                    state === UsageLimitState.Blocked ? 0 : (remaining ?? 0),
                    currency,
                  )}{' '}
                  <span className={secondaryTextClassName}>
                    {text.leftOfLabel}{' '}
                    {formatUsageAmount(window.limit ?? 0, currency)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    role="progressbar"
                    aria-valuenow={window.used}
                    aria-valuemin={0}
                    aria-valuemax={window.limit ?? undefined}
                    aria-label={window.title}
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-layer-4"
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
                  <span
                    className={mergeClasses(
                      'dial-tiny-semi-text shrink-0',
                      colors.textClassName,
                    )}
                  >
                    {text.percentUsedLabel(Math.round(percentage))}
                  </span>
                </div>
              </>
            )}

            <div
              className={mergeClasses(
                'flex items-center gap-1.5',
                secondaryTextClassName,
              )}
            >
              <IconClock
                size={12}
                className="shrink-0 opacity-70"
                aria-hidden
              />
              {window.resetLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
};
