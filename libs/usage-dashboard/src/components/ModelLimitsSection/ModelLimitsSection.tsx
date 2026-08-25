import {
  buildCssVars,
  mergeClasses,
  PanelEmptyState,
} from '@epam/ai-dial-chat-shared';
import { IconChartBar } from '@tabler/icons-react';
import { FC } from 'react';
import { ModelLimitsSectionProps } from '../../models/model-limits-props';
import { MODEL_LIMITS_GRID_COLUMNS, ModelLimitsRow } from './ModelLimitsRow';
import styles from './ModelLimitsSection.module.scss';

const AVATAR_SIZE = 40;

/** "Model limits" section: a fixed table comparing Cost and Tokens across three rolling periods. */
export const ModelLimitsSection: FC<ModelLimitsSectionProps> = ({
  rows,
  labels,
  styles: stylesProp,
  emptyStateIconSize = 48,
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
      <div className="flex min-h-10 items-center">
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
      </div>

      <div
        role="table"
        aria-label={tableLabel}
        className={mergeClasses(
          'overflow-hidden rounded-xl shadow-md',
          styles.container,
        )}
      >
        {rows.length === 0 ? (
          <div className="flex items-center justify-center px-6 py-10">
            <PanelEmptyState
              icon={
                <IconChartBar
                  aria-hidden
                  size={emptyStateIconSize}
                  stroke={1}
                />
              }
              label={labels.emptyStateLabel}
            />
          </div>
        ) : (
          <>
            <div
              role="row"
              className={mergeClasses(
                'hidden gap-4 px-6 py-3 desktop:grid desktop:items-center',
                MODEL_LIMITS_GRID_COLUMNS,
                styles.headerRow,
              )}
            >
              {(
                [
                  labels.itemColumnLabel,
                  labels.last24HoursColumnLabel,
                  labels.last7DaysColumnLabel,
                  labels.last30DaysColumnLabel,
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
          </>
        )}
      </div>
    </div>
  );
};
