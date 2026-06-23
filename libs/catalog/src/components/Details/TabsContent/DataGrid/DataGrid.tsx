import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, Fragment, ReactNode } from 'react';
import styles from './DataGrid.module.scss';

/** Props for `DataGrid`. */
export interface DataGridProps {
  /** Column header labels. Length determines the column count. */
  columns: string[];
  /** Each row as an ordered array of cell content matching `columns` length. */
  rows: ReactNode[][];
  /**
   * CSS `grid-template-columns` value.
   * Defaults to `repeat(N, 1fr)` where N is `columns.length`.
   */
  columnsTemplate?: string;
  /** CSS class for header cells. Defaults to `'dial-caption-text'`. */
  headingClassName?: string;
  /** CSS class for data cells. Defaults to `'dial-tiny-text'`. */
  cellClassName?: string;
}

/** Renders a bordered grid with a header row and striped data rows. */
export const DataGrid: FC<DataGridProps> = ({
  columns,
  rows,
  columnsTemplate,
  headingClassName = 'dial-caption-text',
  cellClassName = 'dial-tiny-text',
}) => {
  const template = columnsTemplate ?? `repeat(${columns.length}, 1fr)`;

  return (
    <div
      className={mergeClasses(
        styles.container,
        'grid overflow-hidden rounded-[6px]',
      )}
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((col) => (
        <div
          key={col}
          className={mergeClasses(
            'px-2 py-1 text-start uppercase',
            headingClassName,
            styles.header,
          )}
        >
          {col}
        </div>
      ))}
      {rows.map((cells, rowIdx) => (
        <Fragment key={rowIdx}>
          {cells.map((cell, colIdx) => (
            <div
              key={colIdx}
              className={mergeClasses(
                'px-2 py-1.5',
                cellClassName,
                styles.cell,
                rowIdx % 2 === 1 ? styles.evenRow : undefined,
              )}
            >
              {cell}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
};
