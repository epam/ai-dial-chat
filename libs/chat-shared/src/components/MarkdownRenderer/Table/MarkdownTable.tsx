import { type FC, type ReactNode, memo } from 'react';
import { useTableScroll } from '../../../hooks/useTableScroll';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './MarkdownTable.module.scss';

export interface MarkdownTableClassNames {
  /** Extra classes on the outer table wrapper. */
  tableWrapper?: string;
  /** Typography class for the table. Defaults to `'text-sm'`. */
  tableFont?: string;
}

export interface MarkdownTableProps {
  children: ReactNode;
  classNames: MarkdownTableClassNames;
}

/** Renders a responsive Markdown table with an end fade while more columns are available. */
export const MarkdownTable: FC<MarkdownTableProps> = memo(
  ({ children, classNames }) => {
    const {
      scrollContainerRef,
      tableRef,
      hasContentBeyondStart,
      hasContentBeyondEnd,
      handleScroll,
    } = useTableScroll();

    return (
      <div
        className={mergeClasses('relative max-w-full', classNames.tableWrapper)}
      >
        <div
          ref={scrollContainerRef}
          className={mergeClasses(
            'max-w-full overflow-x-auto rounded',
            styles.scrollContainer,
            {
              [styles.tableScrollFadeBoth]:
                hasContentBeyondStart && hasContentBeyondEnd,
              [styles.tableScrollFadeStart]:
                hasContentBeyondStart && !hasContentBeyondEnd,
              [styles.tableScrollFadeEnd]:
                !hasContentBeyondStart && hasContentBeyondEnd,
            },
          )}
          onScroll={handleScroll}
        >
          <table
            ref={tableRef}
            className={mergeClasses(
              'w-max min-w-full border-collapse',
              classNames.tableFont ?? 'text-sm',
            )}
          >
            {children}
          </table>
        </div>
      </div>
    );
  },
);
