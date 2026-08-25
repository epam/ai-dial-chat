import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitPeriodCell,
  ModelLimitPeriodStatus,
  ModelLimitsLabels,
  ModelLimitsTypography,
} from '../../models/model-limits-props';
import { MetricCell } from './MetricCell';
import styles from './ModelLimitsSection.module.scss';
import { PeriodStatusIndicator } from './PeriodStatusIndicator';

interface PeriodCellProps {
  cell: ModelLimitPeriodCell;
  periodLabel: string;
  periodStatus: ModelLimitPeriodStatus;
  labels: ModelLimitsLabels;
  typography: ModelLimitsTypography;
}

interface CostValueProps {
  cell: ModelLimitMetricCell;
  label: string;
  unavailableLabel: string;
  typography: ModelLimitsTypography;
}

const CostValue: FC<CostValueProps> = ({
  cell,
  label,
  unavailableLabel,
  typography,
}) => {
  const { secondaryValueClassName = 'dial-tiny-text' } = typography;
  const isUnavailable = cell.kind === ModelLimitMetricKind.Unavailable;

  return (
    <div className="flex min-w-0 items-baseline gap-1">
      <span className="sr-only">{label}: </span>
      <span
        className={mergeClasses(
          'min-w-0 break-words',
          secondaryValueClassName,
          styles.secondaryValue,
        )}
        title={isUnavailable ? unavailableLabel : cell.usedLabel}
      >
        {isUnavailable ? unavailableLabel : cell.usedLabel}
      </span>
    </div>
  );
};

/** One rolling-period table cell containing the period's Tokens progress and attributed Cost. */
export const PeriodCell: FC<PeriodCellProps> = ({
  cell,
  periodLabel,
  periodStatus,
  labels,
  typography,
}) => (
  <div role="cell" className="flex min-w-0 flex-col gap-2 py-2 desktop:py-0">
    <div
      className={mergeClasses(
        'dial-caption-lead-semi-text flex min-h-11 items-center justify-between gap-2 desktop:hidden',
        styles.mobileColumnLabel,
      )}
    >
      <span>{periodLabel}</span>
      <PeriodStatusIndicator periodStatus={periodStatus} />
    </div>
    <MetricCell
      cell={cell.tokens}
      label={labels.tokensLabel}
      progressAriaLabel={`${periodLabel} ${labels.tokensLabel}`}
      showProgress
      labels={labels}
      typography={typography}
    />
    <CostValue
      cell={cell.cost}
      label={labels.costLabel}
      unavailableLabel={labels.unavailableLabel}
      typography={typography}
    />
  </div>
);
