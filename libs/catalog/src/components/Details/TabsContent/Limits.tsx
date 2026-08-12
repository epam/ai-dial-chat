import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialProgressBar, DialProgressBarSize } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type {
  CatalogItemLimits,
  UsageLimitProgressRow,
} from '../../../models/item-details-data';

const getProgressValue = (row: UsageLimitProgressRow): number => {
  if (!Number.isFinite(row.used) || !Number.isFinite(row.total)) {
    return 0;
  }

  return Math.min(Math.max(row.used, 0), Math.max(row.total, 0));
};

const getProgressMax = (total: number): number =>
  Number.isFinite(total) && total > 0 ? total : 1;

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const getValueLabel = ({ used, total, valueLabel }: UsageLimitProgressRow) =>
  valueLabel ??
  `${numberFormatter.format(used)} / ${numberFormatter.format(total)}`;

const hasProgress = ({ total }: UsageLimitProgressRow) =>
  Number.isFinite(total) && total > 0;

/** Props for `LimitsTab`. */
export interface LimitsTabProps {
  /** Limits data to render. */
  limits?: CatalogItemLimits;
  /** CSS class for row labels. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** CSS class for row values. Defaults to `'dial-small-text'`. */
  valueClassName?: string;
}

/** Renders model usage limits as labeled progress bars. */
export const LimitsTab: FC<LimitsTabProps> = ({
  limits,
  labelClassName = 'dial-small-semi-text',
  valueClassName = 'dial-small-text',
}) => {
  if (limits == null || limits.rows.length === 0) {
    return null;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {limits.rows.map((row) => {
        const valueLabel = getValueLabel(row);
        const shouldRenderProgress = hasProgress(row);

        return (
          <li key={row.label} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <span
                className={mergeClasses('min-w-0 break-words', labelClassName)}
              >
                {row.label}
              </span>
              <span className={mergeClasses('shrink-0', valueClassName)}>
                {valueLabel}
              </span>
            </div>
            {shouldRenderProgress && (
              <DialProgressBar
                value={getProgressValue(row)}
                max={getProgressMax(row.total)}
                size={DialProgressBarSize.Medium}
                className="w-full"
                ariaLabel={row.ariaLabel ?? `${row.label}: ${valueLabel}`}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};
