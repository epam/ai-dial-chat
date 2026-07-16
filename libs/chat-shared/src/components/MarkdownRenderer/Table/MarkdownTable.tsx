import { type FC, type ReactNode, memo } from 'react';
import { useTableScroll } from '../../../hooks/useTableScroll';
import { buildCssVars } from '../../../utils/build-css-vars';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './MarkdownTable.module.scss';

/** Per-element className overrides for {@link MarkdownTable}. */
export interface MarkdownTableClassNames {
  /** Extra classes on the outer table wrapper. */
  tableWrapper?: string;
  /** Typography class for the table. Defaults to `'text-sm'`. */
  tableFont?: string;
}

/** CSS custom-property overrides for the `MarkdownTable` component. */
export interface MarkdownTableColors {
  /** Scroll container border color. */
  border?: string;
  /** Scrollbar thumb/track color. */
  scrollbar?: string;
  /** Edge-fade mask color. */
  fade?: string;
}

/** Props for {@link MarkdownTable}. */
export interface MarkdownTableProps {
  /** Table body/children rendered inside the scrollable wrapper (typically `<thead>`/`<tbody>` from react-markdown). */
  children: ReactNode;
  /** Per-element className overrides. */
  classNames: MarkdownTableClassNames;
  /** Color overrides applied as CSS custom properties. */
  colors?: MarkdownTableColors;
}

/** Renders a responsive Markdown table with an end fade while more columns are available. */
export const MarkdownTable: FC<MarkdownTableProps> = memo(
  ({ children, classNames, colors }) => {
    const {
      scrollContainerRef,
      tableRef,
      hasContentBeyondStart,
      hasContentBeyondEnd,
      handleScroll,
    } = useTableScroll();
    const cssVars = buildCssVars({
      '--cm-markdown-border': colors?.border,
      '--cm-table-scrollbar': colors?.scrollbar,
      '--cm-table-fade': colors?.fade,
    });

    return (
      <div
        style={cssVars}
        className={mergeClasses(
          'relative w-full min-w-0 max-w-full overflow-hidden',
          classNames.tableWrapper,
        )}
      >
        <div
          ref={scrollContainerRef}
          className={mergeClasses(
            'w-full min-w-0 max-w-full overflow-x-auto rounded border',
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
