import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialNoDataContent } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';
import {
  type ModelUsageRowData,
  type UsageModelTableLabels,
  UsageRowScope,
} from '../../types/usage-limit';
import { UsageModelRow } from './UsageModelRow';

/** English default copy for `UsageModelTable`. The consuming app overrides these with translated strings. */
const DEFAULT_LABELS: UsageModelTableLabels = {
  modelColumnLabel: 'Model',
  todayColumnLabel: 'Today',
  monthColumnLabel: 'This month',
  statusColumnLabel: 'Status',
  modelEyebrowLabel: 'Model',
  capValueLabel: (formattedUsed, formattedLimit) =>
    `${formattedUsed} / ${formattedLimit}`,
  capReachedLabel: (scope) =>
    scope === UsageRowScope.Daily ? 'Daily cap reached' : 'Monthly cap reached',
  nearCapLabel: (scope) =>
    scope === UsageRowScope.Daily ? 'Near daily cap' : 'Near monthly cap',
  withinLimitsLabel: 'Within limits',
  noLimitLabel: 'No limit · rolls up',
  emptyTitle: 'No usage yet',
  emptyDescription: 'Model usage will appear here once you start chatting.',
};

/** Props for `UsageModelTable`. */
export interface UsageModelTableProps {
  /** The rows to render, one per model. */
  rows: ModelUsageRowData[];
  /** ISO 4217 currency code used to format amounts. Defaults to `'USD'`. */
  currency?: string;
  /** Fraction of remaining budget at/below which a period becomes `Warning`. Defaults to `0.15` (85% used). */
  warningThreshold?: number;
  /** Extra classes applied to the table's root element. */
  className?: string;
  /** Class for the column header row text. Defaults to the app's uppercase, tracked-out section-header style, in a WCAG AA-safe shade. */
  headerClassName?: string;
  /** User-visible copy overrides. Merged over English defaults — pass translated strings here. */
  labels?: Partial<UsageModelTableLabels>;
}

/**
 * Cardless by-model usage table: a header rule followed by hairline-divided rows, each
 * showing a model tile, today/this-month spend (with a mini meter once capped), and a
 * left-aligned status indicator. Renders an empty state when there are no rows.
 */
export const UsageModelTable: FC<UsageModelTableProps> = ({
  rows,
  currency = 'USD',
  warningThreshold,
  className,
  headerClassName = 'dial-tiny-semi-text uppercase tracking-wider text-secondary',
  labels,
}) => {
  const text = { ...DEFAULT_LABELS, ...labels };

  if (rows.length === 0) {
    return (
      <DialNoDataContent
        title={text.emptyTitle}
        description={text.emptyDescription}
      />
    );
  }

  return (
    <div className={mergeClasses('flex flex-col', className)}>
      <div className="hidden grid-cols-[minmax(200px,1fr)_1fr_1fr_1fr] gap-4 border-b border-tertiary px-3 pb-3 desktop:grid">
        <span className={headerClassName}>{text.modelColumnLabel}</span>
        <span className={headerClassName}>{text.todayColumnLabel}</span>
        <span className={headerClassName}>{text.monthColumnLabel}</span>
        <span className={mergeClasses(headerClassName, 'justify-self-start')}>
          {text.statusColumnLabel}
        </span>
      </div>

      {rows.map((row) => (
        <UsageModelRow
          key={row.id}
          name={row.name}
          version={row.version}
          today={row.today}
          thisMonth={row.thisMonth}
          currency={currency}
          warningThreshold={warningThreshold}
          labels={text}
        />
      ))}
    </div>
  );
};
