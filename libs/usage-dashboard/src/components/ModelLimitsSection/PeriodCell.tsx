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
  const {
    valueClassName = 'dial-small-text',
    secondaryValueClassName = 'dial-tiny-text',
  } = typography;
  const isUnavailable = cell.kind === ModelLimitMetricKind.Unavailable;

  return (
    <div className="ms-auto flex min-w-0 max-w-[45%] items-baseline gap-1">
      <span className="sr-only">{label}: </span>
      <span
        className={mergeClasses(
          'min-w-0 truncate',
          isUnavailable ? secondaryValueClassName : valueClassName,
          isUnavailable ? styles.secondaryValue : styles.value,
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
  labels,
  typography,
}) => (
  <div role="cell" className="flex min-w-0 flex-col gap-3 py-2 desktop:py-0">
    <span
      className={mergeClasses(
        'dial-caption-lead-semi-text block desktop:hidden',
        styles.mobileColumnLabel,
      )}
    >
      {periodLabel}
    </span>
    <MetricCell
      cell={cell.tokens}
      label={labels.tokensLabel}
      progressAriaLabel={`${periodLabel} ${labels.tokensLabel}`}
      showProgress
      trailingValue={
        <CostValue
          cell={cell.cost}
          label={labels.costLabel}
          unavailableLabel={labels.unavailableLabel}
          typography={typography}
        />
      }
      labels={labels}
      typography={typography}
    />
  </div>
);
