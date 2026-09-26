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

/* A cell's prose is read back as inline Markdown, so both the escape character
   and the cell delimiter have to be escaped, in that order: GFM returns `\\`
   as one backslash and `\|` as a literal pipe. Escaping only the pipe would
   serialize `a \| b` as `a \\| b`, where the pipe arrives unescaped and splits
   the row. */
const escapeMarkdownText = (value: string): string =>
  value.replace(/\\/g, String.raw`\\`).replace(/\|/g, String.raw`\|`);

/* A pipe inside a formula cannot be escaped the same way. GFM resolves `\|`
   only in text: inside `$$…$$` the backslash is left in place, so an escaped
   pipe reaches KaTeX as `\|` — the norm delimiter ‖ rather than the bar that
   was written — while an unescaped one splits the row. Both pipe forms are
   therefore rewritten to the LaTeX commands for those glyphs, which renders
   identically and leaves no pipe in the cell to escape.

   Known limit: a pipe in a column spec (`\begin{array}{c|c}`) is a column rule
   rather than a glyph, so no form of it survives a table cell — KaTeX rejects
   `\vert` and `\|` alike there. Rewriting at least keeps the row intact, so
   the damage stays inside the one formula. */
const rewriteMathPipes = (source: string): string =>
  source.replace(/\\\||\|/g, (pipe, offset: number) => {
    const command = pipe === '|' ? String.raw`\vert` : String.raw`\Vert`;
    /* A command name swallows the letters that follow it, so `|x|` has to
       become `\vert x\vert`, not `\vertx\vert`. */
    const separator = /^[a-zA-Z]/.test(source.slice(offset + pipe.length))
      ? ' '
      : '';

    return `${command}${separator}`;
  });

/* The two formats differ in both halves of a cell, so each carries its own
   pair of rules. Markdown escapes its text and wraps a formula as `$$…$$`
   rather than `$…$`, because the renderer that reads this back configures
   `remark-math` with `singleDollarTextMath: false`, which leaves single
   dollars as literal text. A spreadsheet wants neither: its column takes the
   bare LaTeX, still the source the model wrote rather than the rendered
   glyphs. */
interface CellTextFormat {
  /** Renders a formula's LaTeX as the cell should carry it. */
  formatFormula: (source: string) => string;
  /** Escapes the parts of a cell that are not a formula. */
  escapeText: (value: string) => string;
}

const MARKDOWN_CELL_FORMAT: CellTextFormat = {
  formatFormula: (source) => `$$${rewriteMathPipes(source)}$$`,
  escapeText: escapeMarkdownText,
};

const CSV_CELL_FORMAT: CellTextFormat = {
  formatFormula: (source) => source,
  escapeText: (value) => value,
};

/* Escaping the finished cell as one string is not an option: by then a formula
   is indistinguishable from the prose around it, and its backslashes must stay
   single. The text is therefore escaped in place, node by node, while the
   formulas are still standing and can be skipped. */
const escapeTextOutsideFormulas = (
  root: HTMLTableCellElement,
  escapeText: (value: string) => string,
): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    if (node.parentElement?.closest(KATEX_SELECTOR) != null) return;

    node.data = escapeText(node.data);
  });
};

const readCellText = (
  cell: HTMLTableCellElement,
  { formatFormula, escapeText }: CellTextFormat,
): string => {
  if (cell.querySelector(KATEX_SELECTOR) == null) {
    return escapeText(cell.textContent?.trim() ?? '');
  }

  /* Cloned so the table the reader is looking at is never mutated. Document
     order puts an outer `.katex` before any nested one, so replacing it
     detaches the inner matches — `contains` then skips them. */
  const clone = cell.cloneNode(true) as HTMLTableCellElement;

  escapeTextOutsideFormulas(clone, escapeText);

  clone.querySelectorAll(KATEX_SELECTOR).forEach((formula) => {
    if (!clone.contains(formula)) return;

    const source = readTexSource(formula);
    formula.replaceWith(
      document.createTextNode(
        source ? formatFormula(source) : escapeText(formula.textContent ?? ''),
      ),
    );
  });

  return clone.textContent?.trim() ?? '';
};

const getCellValues = (
  row: HTMLTableRowElement,
  format: CellTextFormat,
): string[] => Array.from(row.cells).map((cell) => readCellText(cell, format));

const serializeCsvRow = (row: HTMLTableRowElement): string =>
  getCellValues(row, CSV_CELL_FORMAT)
    .map((value) => (value ? `"${value.replace(/"/g, '""')}"` : ''))
    .join(',');

const serializeMarkdownRow = (row: HTMLTableRowElement): string =>
  `| ${getCellValues(row, MARKDOWN_CELL_FORMAT).join(' | ')} |`;

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
