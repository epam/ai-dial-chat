import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, ProgressBar } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitsLabels,
  ModelLimitStatus,
  ModelLimitsTypography,
} from '../../models/model-limits-props';
import styles from './ModelLimitsSection.module.scss';

const getProgressFillClassName = (status: ModelLimitStatus | undefined) => {
  switch (status) {
    case ModelLimitStatus.RunningLow:
      return styles.progressFillWarning;
    case ModelLimitStatus.LimitReached:
      return styles.progressFillError;
    default:
      return styles.progressFillDefault;
  }
};

interface MetricCellProps {
  cell: ModelLimitMetricCell;
  label: string;
  progressAriaLabel: string;
  showProgress: boolean;
  labels: ModelLimitsLabels;
  typography: ModelLimitsTypography;
}

/** Renders one normalized Cost or Tokens value without owning its table-cell semantics. */
export const MetricCell: FC<MetricCellProps> = ({
  cell,
  label,
  progressAriaLabel,
  showProgress,
  labels,
  typography,
}) => {
  const {
    valueClassName = 'dial-small-text',
    secondaryValueClassName = 'dial-tiny-text',
  } = typography;

  const value = (
    <span className={mergeClasses(valueClassName, styles.value)}>
      {cell.usedLabel}
    </span>
  );

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="sr-only">{label}: </span>
      {cell.kind === ModelLimitMetricKind.Unlimited && (
        <div
          className="flex min-w-0 items-start gap-2"
          role="group"
          aria-label={progressAriaLabel}
        >
          <div className="flex min-w-0 flex-col gap-1">
            {value}
            <span
              className={mergeClasses(
                secondaryValueClassName,
                styles.secondaryValue,
              )}
            >
              {cell.supportingLabel ?? labels.noLimitLabel}
            </span>
          </div>
        </div>
      )}
      {cell.kind === ModelLimitMetricKind.Unavailable && (
        <div
          className="flex min-w-0 items-baseline gap-2"
          role="group"
          aria-label={progressAriaLabel}
        >
          <span
            className={mergeClasses(
              secondaryValueClassName,
              styles.secondaryValue,
            )}
          >
            {labels.unavailableLabel}
          </span>
        </div>
      )}
      {cell.kind === ModelLimitMetricKind.Finite && (
        <div className="flex min-w-0 flex-col gap-2">
          <div
            className="flex min-w-0 items-baseline gap-2"
            role="group"
            aria-label={progressAriaLabel}
          >
            <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
              {value}
              <span
                className={mergeClasses(valueClassName, styles.secondaryValue)}
              >
                / {cell.totalLabel}
              </span>
            </div>
          </div>
          {showProgress && (
            <ProgressBar
              value={Math.min(cell.usedPercent ?? 0, 100)}
              max={100}
              size={ElementSize.Small}
              className={mergeClasses(
                '!h-1 w-full',
                styles.progressTrack,
                getProgressFillClassName(cell.status),
              )}
              aria-label={progressAriaLabel}
              aria-valuetext={cell.ariaLabel}
            />
          )}
        </div>
      )}
    </div>
  );
};
