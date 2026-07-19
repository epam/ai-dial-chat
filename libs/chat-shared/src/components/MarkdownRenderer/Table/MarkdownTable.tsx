import { type FC, type ReactNode, memo } from 'react';
import { useTableScroll } from '../../../hooks/useTableScroll';
import { CodeBlockTheme } from '../../../types/code-editor';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './MarkdownTable.module.scss';

/** Per-element className overrides for {@link MarkdownTable}. */
export interface MarkdownTableClassNames {
  /** Extra classes on the outer table wrapper. */
  tableWrapper?: string;
  /** Typography class for the table. Defaults to `'text-sm'`. */
  tableFont?: string;
}

/** Props for {@link MarkdownTable}. */
export interface MarkdownTableProps {
  /** Table body/children rendered inside the scrollable wrapper (typically `<thead>`/`<tbody>` from react-markdown). */
  children: ReactNode;
  /** Per-element className overrides. */
  classNames: MarkdownTableClassNames;
  /** Color theme for the table surface. Defaults to `'dark'`. */
  theme?: CodeBlockTheme;
  /**
   * Accessible label announced for the horizontally scrollable region.
   * Defaults to `'Scrollable table'`.
   */
  scrollRegionAriaLabel?: string;
}

/** Renders a responsive Markdown table with an end fade while more columns are available. */
export const MarkdownTable: FC<MarkdownTableProps> = memo(
  ({
    children,
    classNames,
    theme = CodeBlockTheme.Dark,
    scrollRegionAriaLabel = 'Scrollable table',
  }) => {
    const {
      scrollContainerRef,
      tableRef,
      hasContentBeyondStart,
      hasContentBeyondEnd,
      handleScroll,
    } = useTableScroll();
    const isLightTheme = theme === CodeBlockTheme.Light;
    const isScrollable = hasContentBeyondStart || hasContentBeyondEnd;

    return (
      <div
        className={mergeClasses(
          'relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border',
          styles.tableContainer,
          isLightTheme && styles.tableContainerLight,
          classNames.tableWrapper,
        )}
      >
        <div
          ref={scrollContainerRef}
          className={mergeClasses(
            'w-full min-w-0 max-w-full overflow-x-auto',
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
          role={isScrollable ? 'region' : undefined}
          aria-label={isScrollable ? scrollRegionAriaLabel : undefined}
          tabIndex={isScrollable ? 0 : undefined}
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
