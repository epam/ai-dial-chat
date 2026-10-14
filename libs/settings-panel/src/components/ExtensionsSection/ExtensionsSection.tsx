import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { ExtensionsSectionProps } from '../../models/extensions-props';
import {
  EXTENSIONS_GRID_COLUMNS,
  ExtensionServiceRow,
} from './ExtensionServiceRow';
import styles from './ExtensionsSection.module.scss';

/** Extensions settings table: a Name / Description / sr-only Actions header row plus one row per service. */
export const ExtensionsSection: FC<ExtensionsSectionProps> = ({
  rows,
  labels,
  styles: stylesProp,
}) => {
  const { colors } = stylesProp ?? {};
  const typography = {
    columnHeaderClassName: 'dial-caption-lead-semi-text',
    ...stylesProp?.typography,
  };

  const cssVars = buildCssVars({
    '--ext-container-bg': colors?.containerBackground,
    '--ext-column-header': colors?.columnHeaderColor,
    '--ext-row-divider': colors?.rowDividerColor,
    '--ext-name': colors?.nameColor,
    '--ext-description': colors?.descriptionColor,
    '--ext-warning-badge': colors?.warningBadgeColor,
  });

  return (
    <div
      role="table"
      aria-label={labels.tableAriaLabel}
      className={mergeClasses(
        'overflow-hidden rounded-xl shadow-md',
        styles.container,
      )}
      style={cssVars}
    >
      <div
        role="row"
        className={mergeClasses(
          'hidden gap-4 px-6 py-3 desktop:grid desktop:items-center',
          EXTENSIONS_GRID_COLUMNS,
          styles.headerRow,
        )}
      >
        <span
          role="columnheader"
          className={mergeClasses(
            'text-start',
            typography.columnHeaderClassName,
            styles.columnHeader,
          )}
        >
          {labels.nameColumnLabel}
        </span>
        <span
          role="columnheader"
          className={mergeClasses(
            'text-start',
            typography.columnHeaderClassName,
            styles.columnHeader,
          )}
        >
          {labels.descriptionColumnLabel}
        </span>
        {/* Visually empty per the design; the sr-only label keeps the header
            announced for screen-reader users browsing the header row. */}
        <span role="columnheader">
          <span className="sr-only">{labels.actionsColumnLabel}</span>
        </span>
      </div>
      <div role="rowgroup">
        {rows.map((row) => (
          <ExtensionServiceRow key={row.id} row={row} typography={typography} />
        ))}
      </div>
    </div>
  );
};
