export enum MarkdownTableCopyFormat {
  Csv = 'csv',
  Markdown = 'markdown',
}

/** Default filename used when downloading a Markdown table as CSV. */
export const DEFAULT_MARKDOWN_TABLE_DOWNLOAD_FILENAME = 'table.csv';
/** MIME type used when downloading a Markdown table as CSV. */
export const MARKDOWN_TABLE_CSV_MIME_TYPE = 'text/csv;charset=utf-8';

export interface MarkdownTableActionLabels {
  copyLabel?: string;
  copiedLabel?: string;
  downloadCsvLabel?: string;
  openInCanvasLabel?: string;
}

/* `rehype-katex` runs in MathML mode, so a formula in a cell is a
   `<span class="katex">` carrying both the rendered glyphs and an
   `<annotation encoding="application/x-tex">` holding the LaTeX it was built
   from. `textContent` concatenates the two, which is how `-\tfrac12` left the
   table as `-12-\tfrac12`. Each formula is therefore swapped for its own
   source before a cell's text is read. */
const KATEX_SELECTOR = '.katex';
const TEX_ANNOTATION_SELECTOR = 'annotation[encoding="application/x-tex"]';

/** LaTeX a formula was rendered from, or `null` when KaTeX left no annotation. */
const readTexSource = (formula: Element): string | null =>
  formula.querySelector(TEX_ANNOTATION_SELECTOR)?.textContent?.trim() || null;

/* `$$…$$` rather than `$…$`: the renderer that reads this Markdown back
   configures `remark-math` with `singleDollarTextMath: false`, so single
   dollars stay literal text. Double dollars inside a line still parse as
   inline math, which is what a table cell needs. */
const wrapAsInlineMath = (source: string): string => `$$${source}$$`;

/* A spreadsheet has no use for math delimiters, so the CSV column carries the
   bare LaTeX — still the source the model wrote, unlike the rendered glyphs. */
const keepTexSource = (source: string): string => source;

const readCellText = (
  cell: HTMLTableCellElement,
  wrapFormula: (source: string) => string,
): string => {
  if (cell.querySelector(KATEX_SELECTOR) == null) {
    return cell.textContent?.trim() ?? '';
  }

  /* Cloned so the table the reader is looking at is never mutated. Document
     order puts an outer `.katex` before any nested one, so replacing it
     detaches the inner matches — `contains` then skips them. */
  const clone = cell.cloneNode(true) as HTMLTableCellElement;

  clone.querySelectorAll(KATEX_SELECTOR).forEach((formula) => {
    if (!clone.contains(formula)) return;

    const source = readTexSource(formula);
    formula.replaceWith(
      document.createTextNode(
        source ? wrapFormula(source) : (formula.textContent ?? ''),
      ),
    );
  });

  return clone.textContent?.trim() ?? '';
};

const getCellValues = (
  row: HTMLTableRowElement,
  wrapFormula: (source: string) => string,
): string[] =>
  Array.from(row.cells).map((cell) => readCellText(cell, wrapFormula));

/* An unescaped pipe ends the cell, so a formula such as `\left|x\right|` would
   split one column into three. Backslashes are escaped first so existing escapes
   remain literal and cannot interfere with pipe escaping. GFM then turns `\|`
   back into a literal pipe when it parses the table, so the LaTeX survives the
   round trip intact. */
const escapeMarkdownCell = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');

const serializeCsvRow = (row: HTMLTableRowElement): string =>
  getCellValues(row, keepTexSource)
    .map((value) => (value ? `"${value.replace(/"/g, '""')}"` : ''))
    .join(',');

const serializeMarkdownRow = (row: HTMLTableRowElement): string => {
  const cells = getCellValues(row, wrapAsInlineMath).map(escapeMarkdownCell);

  return `| ${cells.join(' | ')} |`;
};

export const serializeMarkdownTableRows = (
  rows: readonly HTMLTableRowElement[],
  format: MarkdownTableCopyFormat,
): string => {
  if (format === MarkdownTableCopyFormat.Csv) {
    return rows.map(serializeCsvRow).join('\n');
  }

  return rows
    .map((row, index) =>
      index === 0
        ? [
            serializeMarkdownRow(row),
            `| ${Array.from(row.cells)
              .map(() => ':--')
              .join(' | ')} |`,
          ].join('\n')
        : serializeMarkdownRow(row),
    )
    .join('\n');
};
