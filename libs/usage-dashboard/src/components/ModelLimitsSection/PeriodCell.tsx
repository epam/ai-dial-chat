import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitPeriodCell,
  ModelLimitsLabels,
  ModelLimitsTypography,
} from '../../models/model-limits-props';
import { MetricCell } from './MetricCell';
import styles from './ModelLimitsSection.module.scss';

interface PeriodCellProps {
  cell: ModelLimitPeriodCell;
  periodLabel: string;
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
  const supportingLabel = isUnavailable ? undefined : cell.supportingLabel;

  const value = (
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

  if (!supportingLabel) return value;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {value}
      <span
        className={mergeClasses(
          'min-w-0 break-words',
          secondaryValueClassName,
          styles.secondaryValue,
        )}
      >
        {supportingLabel}
      </span>
    </div>
  );
};

/** One calendar-period table cell containing the period's Tokens progress and attributed Cost. */
export const PeriodCell: FC<PeriodCellProps> = ({
  cell,
  periodLabel,
  labels,
  typography,
}) => (
  <div className="flex size-full min-w-0 flex-col justify-center gap-2">
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
