export enum MarkdownTableCopyFormat {
  Csv = 'csv',
  Txt = 'txt',
  Markdown = 'markdown',
}

/** Default filename used when downloading a Markdown table as CSV. */
export const DEFAULT_MARKDOWN_TABLE_DOWNLOAD_FILENAME = 'table.csv';
/** MIME type used when downloading a Markdown table as CSV. */
export const MARKDOWN_TABLE_CSV_MIME_TYPE = 'text/csv;charset=utf-8';

export interface MarkdownTableActionLabels {
  copyCsvLabel?: string;
  copyTxtLabel?: string;
  copyMarkdownLabel?: string;
  copiedLabel?: string;
  downloadCsvLabel?: string;
  openInCanvasLabel?: string;
}

const getCellValues = (row: HTMLTableRowElement): string[] =>
  Array.from(row.cells).map((cell) => cell.textContent?.trim() ?? '');

const serializeCsvRow = (row: HTMLTableRowElement): string =>
  getCellValues(row)
    .map((value) => (value ? `"${value.replace(/"/g, '""')}"` : ''))
    .join(',');

const serializeTxtRow = (row: HTMLTableRowElement): string =>
  getCellValues(row).join('\t');

const serializeMarkdownRow = (row: HTMLTableRowElement): string =>
  `| ${getCellValues(row).join(' | ')} |`;

export const serializeMarkdownTableRows = (
  rows: readonly HTMLTableRowElement[],
  format: MarkdownTableCopyFormat,
): string => {
  if (format === MarkdownTableCopyFormat.Csv) {
    return rows.map(serializeCsvRow).join('\n');
  }

  if (format === MarkdownTableCopyFormat.Txt) {
    return rows.map(serializeTxtRow).join('\n');
  }

  return rows
    .map((row, index) =>
      index === 0
        ? [
            serializeMarkdownRow(row),
            `| ${getCellValues(row)
              .map(() => ':--')
              .join(' | ')} |`,
          ].join('\n')
        : serializeMarkdownRow(row),
    )
    .join('\n');
};
