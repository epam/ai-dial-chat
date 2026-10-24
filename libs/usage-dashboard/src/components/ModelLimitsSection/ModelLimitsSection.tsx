import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Grid,
  GridAppearance,
  type GridProps,
} from '@epam/ai-dial-ui-kit/grid';
import { FC, useMemo } from 'react';
import {
  ModelLimitPeriodCell,
  ModelLimitRow,
  ModelLimitsSectionProps,
} from '../../models/model-limits-props';
import { ItemCell } from './ItemCell';
import styles from './ModelLimitsSection.module.scss';
import { PeriodCell } from './PeriodCell';
import { PeriodHeader } from './PeriodHeader';
import { StatusCell } from './StatusCell';

/* Typed from the kit's own props, so the lib needs no ag-grid import. */
type ModelLimitsColDef = NonNullable<
  GridProps<ModelLimitRow>['columnDefs']
>[number];

/** Props every cell renderer reads: the row it renders. */
interface RowCellProps {
  data?: ModelLimitRow;
}

/** Two-line header: the column label and a period's reset line. */
const HEADER_HEIGHT = 56;
/** The design's Relaxed row density: a period cell stacks the Tokens value, its progress track and the Cost line. */
const ROW_HEIGHT = 84;
/*
 * Constant so ag-grid keeps its columns across renders. `suppressSizeToFit`
 * keeps the kit Grid's `sizeColumnsToFit` from overriding `flex`, so the
 * columns fill the width down to their `minWidth`, and below that the grid
 * scrolls horizontally inside its own box.
 */
const DEFAULT_COL_DEF: ModelLimitsColDef = {
  sortable: false,
  filter: false,
  floatingFilter: false,
  resizable: false,
  suppressSizeToFit: true,
  suppressMovable: true,
};
const GRID_OPTIONS: GridProps<ModelLimitRow>['additionalGridOptions'] = {
  domLayout: 'autoHeight',
  /* Five columns: keeping all of them in the DOM keeps the reading order
     complete when a narrow screen scrolls some of them out of view. */
  suppressColumnVirtualisation: true,
  headerHeight: HEADER_HEIGHT,
  rowHeight: ROW_HEIGHT,
  defaultColDef: DEFAULT_COL_DEF,
};
const PERIODS = ['day', 'week', 'month'] as const;
const getRowId = (row: ModelLimitRow) => row.id;

/** "Model limits" section: a fixed table comparing Cost and Tokens across the current UTC day, week, and month. */
export const ModelLimitsSection: FC<ModelLimitsSectionProps> = ({
  rows,
  labels,
  periodStatuses,
  styles: stylesProp,
}) => {
  const { colors, typography = {} } = stylesProp ?? {};
  const {
    headingClassName = 'dial-body-semi-text',
    headingCountClassName = 'dial-tiny-semi-text',
    columnHeaderClassName = 'dial-caption-lead-semi-text',
  } = typography;

  const cssVars = buildCssVars({
    '--mls-heading': colors?.headingColor,
    '--mls-heading-count': colors?.headingCountColor,
    '--mls-name': colors?.nameColor,
    '--mls-model-type': colors?.modelTypeColor,
    '--mls-version': colors?.versionColor,
    '--mls-value': colors?.valueColor,
    '--mls-secondary-value': colors?.secondaryValueColor,
    '--mls-progress-track': colors?.progressTrackColor,
    '--mls-progress-default': colors?.defaultProgressColor,
    '--mls-progress-warning': colors?.warningProgressColor,
    '--mls-progress-error': colors?.errorProgressColor,
    '--mls-indicator-warning': colors?.warningIndicatorColor,
    '--mls-indicator-error': colors?.errorIndicatorColor,
    '--mls-badge-default-bg': colors?.defaultBadgeBackground,
    '--mls-badge-default-text': colors?.defaultBadgeColor,
    '--mls-badge-warning-bg': colors?.warningBadgeBackground,
    '--mls-badge-warning-text': colors?.warningBadgeColor,
    '--mls-badge-error-bg': colors?.errorBadgeBackground,
    '--mls-badge-error-text': colors?.errorBadgeColor,
    '--mls-badge-neutral-text': colors?.neutralBadgeColor,
  });

  const columnDefs = useMemo<ModelLimitsColDef[]>(() => {
    const periodLabels: Record<(typeof PERIODS)[number], string> = {
      day: labels.dayColumnLabel,
      week: labels.weekColumnLabel,
      month: labels.monthColumnLabel,
    };
    const renderPlainHeader = (label: string) => () => (
      <span className={mergeClasses('min-w-0 truncate', columnHeaderClassName)}>
        {label}
      </span>
    );

    return [
      {
        colId: 'item',
        headerName: labels.itemColumnLabel,
        headerComponent: renderPlainHeader(labels.itemColumnLabel),
        flex: 1.25,
        minWidth: 192,
        cellRenderer: ({ data }: RowCellProps) =>
          data ? (
            <ItemCell
              row={data}
              modelTypeLabel={labels.modelTypeLabel}
              typography={typography}
            />
          ) : null,
      },
      ...PERIODS.map((period): ModelLimitsColDef => ({
        colId: period,
        headerName: periodLabels[period],
        headerComponent: () => (
          <PeriodHeader
            label={periodLabels[period]}
            periodStatus={periodStatuses[period]}
            className={columnHeaderClassName}
          />
        ),
        flex: 1,
        minWidth: 160,
        cellRenderer: ({ data }: RowCellProps) => {
          const cell: ModelLimitPeriodCell | undefined = data?.[period];
          return cell ? (
            <PeriodCell
              cell={cell}
              periodLabel={periodLabels[period]}
              labels={labels}
              typography={typography}
            />
          ) : null;
        },
      })),
      {
        colId: 'status',
        headerName: labels.statusColumnLabel,
        headerComponent: renderPlainHeader(labels.statusColumnLabel),
        flex: 0.75,
        minWidth: 128,
        cellRenderer: ({ data }: RowCellProps) =>
          data ? (
            <StatusCell
              status={data.status}
              labels={labels}
              typography={typography}
            />
          ) : null,
      },
    ];
  }, [labels, periodStatuses, typography, columnHeaderClassName]);

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

      {/* The kit's "Chat table": borderless 12px card with the MD shadow, inset row dividers. */}
      <Grid<ModelLimitRow>
        appearance={GridAppearance.Chat}
        columnDefs={columnDefs}
        rowData={rows}
        getRowId={getRowId}
        withoutHeaderBorders
        wrapCustomCellRenderers={false}
        emptyStateTitle={labels.emptyStateLabel}
        emptyStateDescription=""
        additionalGridOptions={GRID_OPTIONS}
        ariaLabel={`${labels.headingLabel} ${rows.length}`}
      />
    </div>
  );
};
