import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconCsv,
  IconDownload,
  IconMaximize,
  IconMarkdown,
  IconTxt,
} from '@tabler/icons-react';
import {
  type FC,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHorizontalOverflow } from '../../../hooks/useHorizontalOverflow';
import { buildCssVars } from '../../../utils/build-css-vars';
import { copyToClipboard } from '../../../utils/copy-to-clipboard';
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
import { TableHeader } from './TableHeader';

export {
  DEFAULT_MARKDOWN_TABLE_DOWNLOAD_FILENAME,
  MARKDOWN_TABLE_CSV_MIME_TYPE,
  MarkdownTableCopyFormat,
  serializeMarkdownTableRows,
  type MarkdownTableActionLabels,
} from './table-serialization';

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
  /** Background of even-indexed body rows. Defaults to `--bg-layer-base`. */
  rowZebraBackground?: string;
  /** Background of a body row on hover. Defaults to `--bg-control-accent-alpha-hover`. */
  rowHoverBackground?: string;
}

/** A table header action rendered as an icon button. */
export interface MarkdownTableHeaderAction {
  /** Stable accessible name and tooltip text. */
  label: string;
  /** Decorative icon content. */
  icon: ReactNode;
  /** Called when the action is activated. */
  onClick: () => void;
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
    const [copiedFormat, setCopiedFormat] = useState<
      MarkdownTableCopyFormat | undefined
    >(undefined);
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
      '--cm-table-row-zebra-bg': colors?.rowZebraBackground,
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

    const handleCopy = useCallback(
      (format: MarkdownTableCopyFormat) => {
        const table = contentRef.current;
        if (table == null) return;

        const text = serializeMarkdownTableRows(Array.from(table.rows), format);
        void copyToClipboard(text).then((success) => {
          if (!success) return;
          if (copiedTimeoutRef.current != null) {
            clearTimeout(copiedTimeoutRef.current);
          }
          setCopiedFormat(format);
          copiedTimeoutRef.current = setTimeout(() => {
            setCopiedFormat(undefined);
          }, COPY_RESET_DELAY_MS);
        });
      },
      [contentRef],
    );

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

    const tableActions: MarkdownTableHeaderAction[] = actionLabels
      ? [
          ...(actionLabels.copyCsvLabel != null
            ? [
                {
                  label: actionLabels.copyCsvLabel,
                  icon:
                    copiedFormat === MarkdownTableCopyFormat.Csv ? (
                      <IconCheck
                        className={styles.copiedIcon}
                        size={DIAL_ICON_SIZE.SM}
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    ) : (
                      <IconCsv
                        size={DIAL_ICON_SIZE.SM}
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    ),
                  onClick: () => handleCopy(MarkdownTableCopyFormat.Csv),
                },
              ]
            : []),
          ...(actionLabels.copyTxtLabel != null
            ? [
                {
                  label: actionLabels.copyTxtLabel,
                  icon:
                    copiedFormat === MarkdownTableCopyFormat.Txt ? (
                      <IconCheck
                        className={styles.copiedIcon}
                        size={DIAL_ICON_SIZE.SM}
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    ) : (
                      <IconTxt
                        size={DIAL_ICON_SIZE.SM}
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    ),
                  onClick: () => handleCopy(MarkdownTableCopyFormat.Txt),
                },
              ]
            : []),
          ...(actionLabels.copyMarkdownLabel != null
            ? [
                {
                  label: actionLabels.copyMarkdownLabel,
                  icon:
                    copiedFormat === MarkdownTableCopyFormat.Markdown ? (
                      <IconCheck
                        className={styles.copiedIcon}
                        size={DIAL_ICON_SIZE.SM}
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    ) : (
                      <IconMarkdown
                        size={DIAL_ICON_SIZE.SM}
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    ),
                  onClick: () => handleCopy(MarkdownTableCopyFormat.Markdown),
                },
              ]
            : []),
          ...(actionLabels.downloadCsvLabel != null
            ? [
                {
                  label: actionLabels.downloadCsvLabel,
                  icon: (
                    <IconDownload
                      size={DIAL_ICON_SIZE.SM}
                      stroke={DIAL_KIT_ICON_STROKE}
                    />
                  ),
                  onClick: handleDownloadCsv,
                },
              ]
            : []),
          ...(actionLabels.openInCanvasLabel != null && onOpenInCanvas != null
            ? [
                {
                  label: actionLabels.openInCanvasLabel,
                  icon: (
                    <IconMaximize
                      size={DIAL_ICON_SIZE.SM}
                      stroke={DIAL_KIT_ICON_STROKE}
                    />
                  ),
                  onClick: handleOpenInCanvas,
                },
              ]
            : []),
        ]
      : [];
    const showHeader = tableActions.length > 0 && !isStreaming;

    return (
      <div
        style={cssVars}
        className={mergeClasses(
          'relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border',
          styles.tableContainer,
          styles.tableContainerLight,
          classNames.tableWrapper,
        )}
      >
        {showHeader && <TableHeader actions={tableActions} />}
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
        {actionLabels?.copiedLabel && (
          <span aria-live="polite" className="sr-only" role="status">
            {copiedFormat ? actionLabels.copiedLabel : ''}
          </span>
        )}
      </div>
    );
  },
);
