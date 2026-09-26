import { ElementSize, GhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  type FC,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CHAT_SHARED_CLASS } from '../../../constants/public-class-names';
import { useHorizontalOverflow } from '../../../hooks/useHorizontalOverflow';
import { buildCssVars } from '../../../utils/build-css-vars';
import { copyMarkdownAsRichText } from '../../../utils/copy-to-clipboard';
import { downloadTextFile } from '../../../utils/file-download';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './MarkdownTable.module.scss';
import {
  DEFAULT_MARKDOWN_TABLE_DOWNLOAD_FILENAME,
  MARKDOWN_TABLE_CSV_MIME_TYPE,
  MarkdownTableCopyFormat,
  serializeMarkdownTableRows,
  type MarkdownTableActionLabels,
} from './table-serialization';
import { useMarkdownTableActions } from './useMarkdownTableActions/useMarkdownTableActions';

export {
  DEFAULT_MARKDOWN_TABLE_DOWNLOAD_FILENAME,
  MARKDOWN_TABLE_CSV_MIME_TYPE,
  MarkdownTableCopyFormat,
  serializeMarkdownTableRows,
  type MarkdownTableActionLabels,
} from './table-serialization';
export type { MarkdownTableHeaderAction } from './useMarkdownTableActions/useMarkdownTableActions';

/** Per-element className overrides for {@link MarkdownTable}. */
export interface MarkdownTableClassNames {
  /** Extra classes on the outer table wrapper. */
  tableWrapper?: string;
  /** Typography class for the table. Defaults to `'dial-small-text'`. */
  tableFont?: string;
  /** Extra classes on the scrollable table region. */
  tableScrollContainer?: string;
}

/** CSS custom-property overrides for the `MarkdownTable` component. */
export interface MarkdownTableColors {
  /** Scroll container border color. */
  border?: string;
  /** Scrollbar thumb/track color. */
  scrollbar?: string;
  /** Edge-fade mask color. */
  fade?: string;
  /** Divider color between rows. Defaults to `--stroke-tertiary`. */
  rowDivider?: string;
  /** Background of a body row on hover. Defaults to `--bg-control-accent-alpha-hover`. */
  rowHoverBackground?: string;
}

/** Props for {@link MarkdownTable}. */
export interface MarkdownTableProps {
  /** Table body/children rendered inside the scrollable wrapper (typically `<thead>`/`<tbody>` from react-markdown). */
  children: ReactNode;
  /** Per-element className overrides. */
  classNames: MarkdownTableClassNames;
  /** Color overrides applied as CSS custom properties. */
  colors?: MarkdownTableColors;
  /** Localized labels for table actions. Supplying them enables the action bar. */
  actionLabels?: MarkdownTableActionLabels;
  /** Filename used when downloading the table as CSV. Defaults to `'table.csv'`. */
  downloadFilename?: string;
  /** When true, table actions are hidden while content is still arriving. */
  isStreaming?: boolean;
  onOpenInCanvas?: (markdown: string) => void;
  /** Accessible label for the horizontally scrollable region. Defaults to `'Scrollable table'`. */
  scrollRegionAriaLabel?: string;
}

const COPY_RESET_DELAY_MS = 2000;

/** Renders a responsive Markdown table with an end fade while more columns are available. */
export const MarkdownTable: FC<MarkdownTableProps> = memo(
  ({
    children,
    classNames,
    colors,
    actionLabels,
    downloadFilename,
    isStreaming,
    onOpenInCanvas,
    scrollRegionAriaLabel = 'Scrollable table',
  }) => {
    const [isCopied, setIsCopied] = useState(false);
    const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const {
      scrollContainerRef,
      contentRef,
      hasContentBeyondStart,
      hasContentBeyondEnd,
      handleScroll,
    } = useHorizontalOverflow<HTMLTableElement>();
    const cssVars = buildCssVars({
      '--cm-markdown-border': colors?.border,
      '--cm-table-scrollbar': colors?.scrollbar,
      '--cm-table-fade': colors?.fade,
      '--cm-table-row-divider': colors?.rowDivider,
      '--cm-table-row-hover-bg': colors?.rowHoverBackground,
    });
    const isScrollable = hasContentBeyondStart || hasContentBeyondEnd;

    useEffect(() => {
      return () => {
        if (copiedTimeoutRef.current != null) {
          clearTimeout(copiedTimeoutRef.current);
        }
      };
    }, []);

    const handleCopy = useCallback(() => {
      const table = contentRef.current;
      if (table == null) return;

      const text = serializeMarkdownTableRows(
        Array.from(table.rows),
        MarkdownTableCopyFormat.Markdown,
      );
      void copyMarkdownAsRichText(text).then((success) => {
        if (!success) return;
        if (copiedTimeoutRef.current != null) {
          clearTimeout(copiedTimeoutRef.current);
        }
        setIsCopied(true);
        copiedTimeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, COPY_RESET_DELAY_MS);
      });
    }, [contentRef]);

    const handleDownloadCsv = useCallback(() => {
      const table = contentRef.current;
      if (table == null) return;

      const csv = serializeMarkdownTableRows(
        Array.from(table.rows),
        MarkdownTableCopyFormat.Csv,
      );
      downloadTextFile(
        `\uFEFF${csv}`,
        downloadFilename ?? DEFAULT_MARKDOWN_TABLE_DOWNLOAD_FILENAME,
        MARKDOWN_TABLE_CSV_MIME_TYPE,
      );
    }, [contentRef, downloadFilename]);

    const handleOpenInCanvas = useCallback(() => {
      const table = contentRef.current;
      if (table == null || onOpenInCanvas == null) return;
      onOpenInCanvas(
        serializeMarkdownTableRows(
          Array.from(table.rows),
          MarkdownTableCopyFormat.Markdown,
        ),
      );
    }, [contentRef, onOpenInCanvas]);

    const tableActions = useMarkdownTableActions({
      actionLabels,
      isCopied,
      onCopy: handleCopy,
      onDownloadCsv: handleDownloadCsv,
      onOpenInCanvas: onOpenInCanvas != null ? handleOpenInCanvas : undefined,
    });
    const showActions = tableActions.length > 0 && !isStreaming;

    return (
      <div
        style={cssVars}
        className={mergeClasses(
          'group/table relative w-full min-w-0 max-w-full rounded-xl border [overflow:clip]',
          styles.tableContainer,
          classNames.tableWrapper,
          CHAT_SHARED_CLASS.table,
        )}
      >
        {showActions && (
          <div className="sticky top-0 z-10 h-0">
            <div className="absolute end-2 top-2 flex items-center gap-1 rounded-lg border border-tertiary bg-layer-raised px-2 py-1 opacity-0 shadow-xs transition-opacity focus-within:opacity-100 group-hover/table:opacity-100">
              {tableActions.map((action) => (
                <GhostIconButton
                  key={action.label}
                  tooltipProps={{ tooltip: action.label }}
                  aria-label={action.label}
                  icon={<span aria-hidden>{action.icon}</span>}
                  size={ElementSize.Small}
                  onClick={action.onClick}
                />
              ))}
            </div>
          </div>
        )}
        <div
          ref={scrollContainerRef}
          className={mergeClasses(
            'w-full min-w-0 max-w-full overflow-x-auto',
            styles.scrollContainer,
            classNames.tableScrollContainer,
            {
              [styles.tableScrollFadeBoth]:
                hasContentBeyondStart && hasContentBeyondEnd,
              [styles.tableScrollFadeStart]:
                hasContentBeyondStart && !hasContentBeyondEnd,
              [styles.tableScrollFadeEnd]:
                !hasContentBeyondStart && hasContentBeyondEnd,
            },
            CHAT_SHARED_CLASS.tableScroll,
          )}
          onScroll={handleScroll}
          role={isScrollable ? 'region' : undefined}
          aria-label={isScrollable ? scrollRegionAriaLabel : undefined}
          tabIndex={isScrollable ? 0 : undefined}
        >
          <table
            ref={contentRef}
            className={mergeClasses(
              'w-max min-w-full border-collapse',
              classNames.tableFont ?? 'dial-small-text',
            )}
          >
            {children}
          </table>
        </div>
        {actionLabels?.copyLabel && (
          <span aria-live="polite" className="sr-only" role="status">
            {isCopied ? (actionLabels.copiedLabel ?? '') : ''}
          </span>
        )}
      </div>
    );
  },
);
