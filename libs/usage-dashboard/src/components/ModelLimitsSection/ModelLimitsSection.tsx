import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { SegmentedControl } from '@epam/ai-dial-ui-kit';
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

/*
 * The 2.0 track already supplies the sunken pill, the raised accent segment and
 * its shadow. What it does not cover is a five-segment row on a phone: the track
 * is `w-fit` with no overflow handling, so the segments scroll horizontally
 * (the scrollbar itself is hidden in the stylesheet) instead of shrinking below
 * their labels, and each one keeps the 44px pointer target that the kit's own
 * 32px height does not reach on touch.
 */
const PERIOD_SELECTOR_CLASS_NAME =
  'max-w-full overflow-x-auto overflow-y-hidden [&>button]:flex-none mobile:[&>button]:h-11';

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
        <SegmentedControl
          aria-label={labels.periodSelectorAriaLabel}
          value={period}
          onChange={onPeriodChange}
          className={mergeClasses(
            PERIOD_SELECTOR_CLASS_NAME,
            styles.periodSelector,
          )}
          items={PERIOD_ORDER.map((value) => ({
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
