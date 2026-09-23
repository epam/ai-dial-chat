import katex from 'katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import {
  MarkdownTableCopyFormat,
  serializeMarkdownTableRows,
} from '../table-serialization';

/* String assertions pin the serializer's output; this suite pins what the
   output means, by reading it back with the same plugin chain
   `MarkdownRenderer` configures. A cell that serializes to plausible-looking
   Markdown can still reach the renderer as a different formula — or split the
   row in two — and only a parse shows it. */
const parse = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkMath, { singleDollarTextMath: false });

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

interface ParsedCell {
  /** Text the parser produced, with escapes resolved. */
  text: string;
  /** LaTeX of each formula in the cell, as the math plugin hands it to KaTeX. */
  formulas: string[];
}

const findTable = (node: MdastNode): MdastNode | undefined => {
  if (node.type === 'table') return node;

  return node.children
    ?.map((child) => findTable(child))
    .find((found) => found != null);
};

const readCell = (cell: MdastNode): ParsedCell => {
  const parsed: ParsedCell = { text: '', formulas: [] };

  const walk = (node: MdastNode): void => {
    if (node.type === 'inlineMath' || node.type === 'math') {
      parsed.formulas.push(node.value ?? '');
    } else if (node.type === 'text') {
      parsed.text += node.value ?? '';
    }

    node.children?.forEach(walk);
  };

  walk(cell);

  return parsed;
};

/** Rows of parsed cells, or `[]` when the Markdown held no table at all. */
const parseTable = (markdown: string): ParsedCell[][] => {
  const table = findTable(parse.runSync(parse.parse(markdown)) as MdastNode);

  return (table?.children ?? []).map((row) =>
    (row.children ?? []).map(readCell),
  );
};

/* The glyphs KaTeX draws, with the LaTeX annotation stripped, so two spellings
   of the same formula can be compared. */
const renderGlyphs = (tex: string): string =>
  katex
    .renderToString(tex, { output: 'mathml', throwOnError: true })
    .replace(/<annotation[\s\S]*?<\/annotation>/g, '')
    .replace(/<[^>]+>/g, '');

const createRow = (...cells: string[]) => {
  const row = document.createElement('tr');

  cells.forEach((cell) => {
    const cellElement = document.createElement('td');
    cellElement.textContent = cell;
    row.appendChild(cellElement);
  });

  return row;
};

/* One cell per formula, rendered the way `rehype-katex` renders it in MathML
   mode: the glyphs, then the LaTeX in an annotation. */
const createMathRow = (...formulas: string[]) => {
  const row = document.createElement('tr');

  formulas.forEach((tex) => {
    const cellElement = document.createElement('td');
    cellElement.innerHTML =
      `<span class="katex"><math><semantics><mrow>` +
      `${katex.renderToString(tex, { output: 'mathml' })}</mrow>` +
      `<annotation encoding="application/x-tex">${tex}</annotation>` +
      `</semantics></math></span>`;
    row.appendChild(cellElement);
  });

  return row;
};

const roundTrip = (rows: HTMLTableRowElement[]): ParsedCell[][] =>
  parseTable(
    serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
  );

describe('serializeMarkdownTableRows — reparsed by the renderer', () => {
  it('hands a formula back to KaTeX unchanged', () => {
    const tex = '-\\tfrac12';

    const [[cell]] = roundTrip([createMathRow(tex)]);

    expect(cell.formulas).toEqual([tex]);
  });

  /* Issue #8807: what the reader sees must be what Canvas receives. An escaped
     pipe used to arrive as `\|`, the norm delimiter, so `|x|` reopened as
     ‖x‖. */
  it('keeps a formula with pipes rendering the same glyphs', () => {
    const tex = '\\left|x\\right|';

    const [[cell]] = roundTrip([createMathRow(tex)]);

    expect(cell.formulas).toHaveLength(1);
    expect(renderGlyphs(cell.formulas[0])).toBe(renderGlyphs(tex));
  });

  it('keeps a formula whose pipes are already norm delimiters', () => {
    const tex = 'a\\|b';

    const [[cell]] = roundTrip([createMathRow(tex)]);

    expect(cell.formulas).toHaveLength(1);
    expect(renderGlyphs(cell.formulas[0])).toBe(renderGlyphs(tex));
  });

  it('does not double the backslashes of a formula', () => {
    const tex = '\\alpha \\wedge \\beta';

    const [[cell]] = roundTrip([createMathRow(tex)]);

    expect(cell.formulas).toEqual([tex]);
  });

  /* A pipe the parser does not recognize as escaped ends the cell, so a
     serialized formula could turn one column into three. */
  it('leaves the column count alone when a formula holds pipes', () => {
    const [header, body] = roundTrip([
      createRow('Set', 'Bound'),
      createMathRow('\\{x : |x| < 1\\}', 'a\\|b'),
    ]);

    expect(header.map((cell) => cell.text)).toEqual(['Set', 'Bound']);
    expect(body).toHaveLength(2);
  });

  it('returns cell text with its pipes and backslashes intact', () => {
    const [[pipes], [backslashes]] = roundTrip([
      createRow('a | b'),
      createRow('C:\\path'),
    ]);

    expect(pipes.text).toBe('a | b');
    expect(backslashes.text).toBe('C:\\path');
  });

  /* A backslash directly before a pipe is where escaping the pipe alone breaks
     down: `a \| b` serialized as `a \\| b` loses the cell boundary. */
  it('returns cell text whose backslash precedes a pipe', () => {
    const [[cell]] = roundTrip([createRow('a \\| b')]);

    expect(cell.text).toBe('a \\| b');
  });

  it('keeps prose and formula apart in a mixed cell', () => {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.innerHTML =
      `a | b <span class="katex"><math><semantics><mrow><mi>α</mi></mrow>` +
      `<annotation encoding="application/x-tex">\\alpha</annotation>` +
      `</semantics></math></span>`;
    row.appendChild(cell);

    const [[parsed]] = roundTrip([row]);

    expect(parsed.text.trim()).toBe('a | b');
    expect(parsed.formulas).toEqual(['\\alpha']);
  });
});
