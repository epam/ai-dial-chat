import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialSegmentedControl } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  ModelLimitsPeriod,
  ModelLimitsSectionProps,
} from '../../models/model-limits-props';
import { MODEL_LIMITS_GRID_COLUMNS, ModelLimitsRow } from './ModelLimitsRow';
import styles from './ModelLimitsSection.module.scss';

const AVATAR_SIZE = 40;

const PERIOD_ORDER: ModelLimitsPeriod[] = [
  ModelLimitsPeriod.LastMinute,
  ModelLimitsPeriod.LastHour,
  ModelLimitsPeriod.Last24Hours,
  ModelLimitsPeriod.Last7Days,
  ModelLimitsPeriod.Last30Days,
];

// TODO: Replace the legacy segmented control and remove these overrides when a 2.0 UI-kit equivalent is available.
const PERIOD_SELECTOR_CLASS_NAME = [
  'box-border !inline-flex max-h-[54px] min-h-10 max-w-full items-center overflow-x-auto overflow-y-hidden !rounded-full border !border-tertiary !bg-layer-sunken p-1 desktop:h-10',
  '[&>button]:!m-0 [&>button]:!h-11 [&>button]:!flex-none [&>button]:!rounded-full [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:!px-4 [&>button]:!py-0 [&>button]:!text-secondary desktop:[&>button]:!h-8',
  '[&>button[aria-selected=true]]:!bg-layer-raised [&>button[aria-selected=true]]:!text-accent [&>button[aria-selected=true]]:!shadow-sm',
].join(' ');

/** "Model limits" section: a heading with row count, a controlled period selector, and a table of per-model Cost/Tokens/Requests/Status metrics. */
export const ModelLimitsSection: FC<ModelLimitsSectionProps> = ({
  rows,
  period,
  onPeriodChange,
  labels,
  styles: stylesProp,
}) => {
  const { colors, typography = {} } = stylesProp ?? {};
  const {
    headingClassName = 'dial-body-semi-text',
    headingCountClassName = 'dial-tiny-semi-text',
    columnHeaderClassName = 'dial-caption-lead-semi-text',
  } = typography;

  const cssVars = buildCssVars({
    '--mls-container-bg': colors?.containerBackground,
    '--mls-heading': colors?.headingColor,
    '--mls-heading-count': colors?.headingCountColor,
    '--mls-column-header': colors?.columnHeaderColor,
    '--mls-row-divider': colors?.rowDividerColor,
    '--mls-name': colors?.nameColor,
    '--mls-model-type': colors?.modelTypeColor,
    '--mls-version': colors?.versionColor,
    '--mls-value': colors?.valueColor,
    '--mls-secondary-value': colors?.secondaryValueColor,
    '--mls-progress-track': colors?.progressTrackColor,
    '--mls-progress-default': colors?.defaultProgressColor,
    '--mls-progress-warning': colors?.warningProgressColor,
    '--mls-progress-error': colors?.errorProgressColor,
    '--mls-badge-default-bg': colors?.defaultBadgeBackground,
    '--mls-badge-default-text': colors?.defaultBadgeColor,
    '--mls-badge-warning-bg': colors?.warningBadgeBackground,
    '--mls-badge-warning-text': colors?.warningBadgeColor,
    '--mls-badge-error-bg': colors?.errorBadgeBackground,
    '--mls-badge-error-text': colors?.errorBadgeColor,
    '--mls-badge-neutral-text': colors?.neutralBadgeColor,
  });

  const tableLabel = `${labels.headingLabel} ${rows.length}`;

  return (
    <div className="flex flex-col gap-4" style={cssVars}>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2">
          <span className={mergeClasses(headingClassName, styles.heading)}>
            {labels.headingLabel}
          </span>
          <span
            className={mergeClasses(headingCountClassName, styles.headingCount)}
          >
            {rows.length}
          </span>
        </h3>
        <DialSegmentedControl
          ariaLabel={labels.periodSelectorAriaLabel}
          value={period}
          onChange={onPeriodChange}
          className={mergeClasses(
            PERIOD_SELECTOR_CLASS_NAME,
            styles.periodSelector,
          )}
          options={PERIOD_ORDER.map((value) => ({
            value,
            label: labels.periodLabels[value],
          }))}
        />
      </div>

      <div
        role="table"
        aria-label={tableLabel}
        className={mergeClasses(
          'overflow-hidden rounded-xl shadow-md',
          styles.container,
        )}
      >
        <div
          role="row"
          className={mergeClasses(
            'hidden gap-4 px-6 py-3 desktop:grid',
            MODEL_LIMITS_GRID_COLUMNS,
            styles.headerRow,
          )}
        >
          {(
            [
              labels.itemColumnLabel,
              labels.costColumnLabel,
              labels.tokensColumnLabel,
              labels.requestsColumnLabel,
              labels.statusColumnLabel,
            ] as const
          ).map((columnLabel) => (
            <span
              key={columnLabel}
              role="columnheader"
              className={mergeClasses(
                columnHeaderClassName,
                styles.columnHeader,
              )}
            >
              {columnLabel}
            </span>
          ))}
        </div>

        <div role="rowgroup">
          {rows.map((row) => (
            <ModelLimitsRow
              key={row.id}
              row={row}
              labels={labels}
              typography={typography}
              avatarSize={AVATAR_SIZE}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
