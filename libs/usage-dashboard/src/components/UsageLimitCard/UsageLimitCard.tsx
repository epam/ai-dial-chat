import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, ProgressBar } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  UsageLimitCardProps,
  UsageLimitStatus,
} from '../../models/usage-limit-card-props';
import styles from './UsageLimitCard.module.scss';

const getBadgeLabel = (
  status: UsageLimitStatus,
  labels: UsageLimitCardProps['labels'],
): string => {
  switch (status) {
    case UsageLimitStatus.RunningLow:
      return labels.runningLowBadgeLabel;
    case UsageLimitStatus.LimitReached:
      return labels.limitReachedBadgeLabel;
    case UsageLimitStatus.Default:
      return labels.defaultBadgeLabel;
  }
};

/** One aggregate cost-limit card, rendered as its own independent box: title, always-visible status badge, prominent used amount, progress bar, and remaining/percent captions (or an "unlimited" state with no ratio). */
export const UsageLimitCard: FC<UsageLimitCardProps> = ({
  data,
  labels,
  styles: stylesProp,
}) => {
  const { colors, typography } = stylesProp ?? {};
  const {
    titleClassName = 'dial-body-semi-text',
    amountClassName = 'dial-display1-text',
    secondaryAmountClassName = 'dial-small-text',
    badgeClassName = 'dial-caption-lead-semi-text',
    usedPercentLabelClassName = 'dial-small-text',
  } = typography ?? {};

  const cssVars = buildCssVars({
    '--uld-card-bg': colors?.cardBackground,
    '--uld-title': colors?.titleColor,
    '--uld-default-accent': colors?.defaultAccentColor,
    '--uld-default-progress': colors?.defaultProgressColor,
    '--uld-warning-accent': colors?.warningAccentColor,
    '--uld-warning-progress': colors?.warningProgressColor,
    '--uld-error-accent': colors?.errorAccentColor,
    '--uld-error-progress': colors?.errorProgressColor,
    '--uld-secondary-amount': colors?.secondaryAmountColor,
    '--uld-progress-track': colors?.progressTrackColor,
    '--uld-default-badge-bg': colors?.defaultBadgeBackground,
    '--uld-default-badge-text': colors?.defaultBadgeColor,
    '--uld-warning-badge-bg': colors?.warningBadgeBackground,
    '--uld-warning-badge-text': colors?.warningBadgeColor,
    '--uld-error-badge-bg': colors?.errorBadgeBackground,
    '--uld-error-badge-text': colors?.errorBadgeColor,
    '--uld-used-percent-label': colors?.usedPercentLabelColor,
  });

  const badgeLabel = getBadgeLabel(data.status, labels);

  return (
    <div
      className={mergeClasses(
        'flex min-w-0 flex-col gap-4 rounded-xl px-6 py-5 shadow-md',
        styles.card,
      )}
      style={cssVars}
      role="group"
      aria-label={`${data.title}, ${data.periodDescription}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={mergeClasses('m-0', titleClassName, styles.title)}>
          {data.title}
        </p>
        <span
          className={mergeClasses(
            'shrink-0 rounded-full px-2 py-1',
            badgeClassName,
            data.status === UsageLimitStatus.Default && styles.defaultBadge,
            data.status === UsageLimitStatus.RunningLow && styles.warningBadge,
            data.status === UsageLimitStatus.LimitReached && styles.errorBadge,
          )}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="m-0 flex flex-wrap items-baseline gap-2">
          <span
            className={mergeClasses(
              amountClassName,
              styles.amount,
              data.status === UsageLimitStatus.Default && styles.defaultAccent,
              data.status === UsageLimitStatus.RunningLow &&
                styles.warningAccent,
              data.status === UsageLimitStatus.LimitReached &&
                styles.errorAccent,
            )}
          >
            {data.usedLabel}
          </span>
          {!data.isUnlimited && data.totalLabel != null && (
            <span
              className={mergeClasses(
                secondaryAmountClassName,
                styles.secondaryAmount,
              )}
            >
              {labels.usedOfTotalLabel({ total: data.totalLabel })}
            </span>
          )}
        </p>

        {!data.isUnlimited && data.usedPercent != null && (
          <>
            <ProgressBar
              value={Math.min(data.usedPercent, 100)}
              max={100}
              size={ElementSize.Small}
              className={mergeClasses(
                '!h-1 w-full',
                styles.progressTrack,
                data.status === UsageLimitStatus.Default &&
                  styles.progressFillDefault,
                data.status === UsageLimitStatus.RunningLow &&
                  styles.progressFillWarning,
                data.status === UsageLimitStatus.LimitReached &&
                  styles.progressFillDanger,
              )}
              aria-label={data.title}
              aria-valuetext={data.progressAriaLabel}
            />
            <div className="flex items-center justify-between gap-2">
              {data.remainingLabel != null && (
                <span
                  className={mergeClasses(
                    secondaryAmountClassName,
                    styles.secondaryAmount,
                  )}
                >
                  {labels.remainingCaptionLabel({
                    remaining: data.remainingLabel,
                  })}
                </span>
              )}
              <span
                className={mergeClasses(
                  'ms-auto',
                  usedPercentLabelClassName,
                  styles.usedPercentLabel,
                )}
              >
                {labels.usedPercentLabel({
                  percent: Math.min(Math.round(data.usedPercent), 100),
                })}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
