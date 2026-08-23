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
  mobileColumnLabel: string;
  labels: ModelLimitsLabels;
  typography: ModelLimitsTypography;
}

/** Renders one Cost/Tokens/Requests cell in one of its three shapes: finite (progress bar), unlimited, or unavailable. */
export const MetricCell: FC<MetricCellProps> = ({
  cell,
  mobileColumnLabel,
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
    <div role="cell" className="flex min-w-0 flex-col gap-1 py-2 desktop:py-0">
      <span
        className={mergeClasses(
          'dial-caption-lead-semi-text mobile:block desktop:hidden',
          styles.mobileColumnLabel,
        )}
      >
        {mobileColumnLabel}
      </span>
      {cell.kind === ModelLimitMetricKind.Unlimited && (
        <div className="flex min-w-0 flex-col gap-1">
          {value}
          <span
            className={mergeClasses(
              secondaryValueClassName,
              styles.secondaryValue,
            )}
          >
            {labels.noLimitLabel}
          </span>
        </div>
      )}
      {cell.kind === ModelLimitMetricKind.Unavailable && (
        <span
          className={mergeClasses(
            secondaryValueClassName,
            styles.secondaryValue,
          )}
        >
          {labels.unavailableLabel}
        </span>
      )}
      {cell.kind === ModelLimitMetricKind.Finite && (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
            {value}
            <span
              className={mergeClasses(valueClassName, styles.secondaryValue)}
            >
              / {cell.totalLabel}
            </span>
          </div>
          <ProgressBar
            value={Math.min(cell.usedPercent ?? 0, 100)}
            max={100}
            size={ElementSize.Small}
            className={mergeClasses(
              '!h-1 w-full',
              styles.progressTrack,
              getProgressFillClassName(cell.status),
            )}
            aria-label={mobileColumnLabel}
            aria-valuetext={cell.ariaLabel}
          />
        </div>
      )}
    </div>
  );
};
