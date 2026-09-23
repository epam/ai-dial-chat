import { describe, expect, it } from 'vitest';
import {
  MarkdownTableCopyFormat,
  serializeMarkdownTableRows,
} from '../table-serialization';

const createRow = (...cells: string[]) => {
  const row = document.createElement('tr');

  cells.forEach((cell) => {
    const cellElement = document.createElement('td');
    cellElement.textContent = cell;
    row.appendChild(cellElement);
  });

  return row;
};

/* The markup `rehype-katex` emits in MathML mode: the rendered glyphs and the
   LaTeX they came from sit side by side, so the cell's `textContent` is the
   two concatenated — `−12` followed by `-\tfrac12`. */
const createMathRow = (...cells: string[]) => {
  const row = document.createElement('tr');

  cells.forEach((tex) => {
    const cellElement = document.createElement('td');
    cellElement.innerHTML =
      `<span class="katex"><math><semantics><mrow><mo>−</mo>` +
      `<mfrac><mn>1</mn><mn>2</mn></mfrac></mrow>` +
      `<annotation encoding="application/x-tex">${tex}</annotation>` +
      `</semantics></math></span>`;
    row.appendChild(cellElement);
  });

  return row;
};

describe('serializeMarkdownTableRows', () => {
  it('quotes non-empty CSV values and escapes embedded quotes', () => {
    const rows = [
      createRow('Draft "final", v2', 'Plain', ''),
      createRow('Alpha', 'Beta'),
    ];

    expect(serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Csv)).toBe(
      '"Draft ""final"", v2","Plain",\n"Alpha","Beta"',
    );
  });

  it('serializes Markdown with a left-aligned separator row', () => {
    const rows = [
      createRow('Name', 'Value'),
      createRow('Alpha', '1'),
      createRow('Beta', '2'),
    ];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| Name | Value |\n| :-- | :-- |\n| Alpha | 1 |\n| Beta | 2 |');
  });

  it('preserves empty cells as empty CSV and TXT values', () => {
    const rows = [createRow('', 'Value')];

    expect(serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Csv)).toBe(
      ',"Value"',
    );
  });
});

/* Reading `textContent` off a rendered formula returns the glyphs and the
   LaTeX run together, which is what corrupted a table reopened in Canvas
   (issue #8807). */
describe('serializeMarkdownTableRows — formula cells', () => {
  it('writes a formula back as the LaTeX it was rendered from', () => {
    const rows = [createRow('Bound'), createMathRow('-\\tfrac12')];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| Bound |\n| :-- |\n| $$-\\tfrac12$$ |');
  });

  it('leaves a formula\u2019s backslashes single, so the LaTeX is not doubled', () => {
    const rows = [createMathRow('\\alpha \\wedge \\beta')];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| $$\\alpha \\wedge \\beta$$ |\n| :-- |');
  });

  it('writes the bare source into a CSV column, without math delimiters', () => {
    const rows = [createMathRow('\\alpha>\\tfrac54')];

    expect(serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Csv)).toBe(
      '"\\alpha>\\tfrac54"',
    );
  });

  /* An escaped pipe is not an option inside `$$…$$`: GFM leaves the backslash
     in place there, so `\|` would reach KaTeX as the norm delimiter ‖. */
  it('rewrites a pipe in the source to the LaTeX that renders it', () => {
    const rows = [createMathRow('\\left|x\\right|')];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| $$\\left\\vert x\\right\\vert$$ |\n| :-- |');
  });

  it('rewrites an escaped pipe to the norm delimiter it stands for', () => {
    const rows = [createMathRow('a\\|b')];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| $$a\\Vert b$$ |\n| :-- |');
  });

  it('keeps the pipe itself in a CSV column, which has no row to split', () => {
    const rows = [createMathRow('\\left|x\\right|')];

    expect(serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Csv)).toBe(
      '"\\left|x\\right|"',
    );
  });

  it('escapes a pipe in ordinary cell text as well', () => {
    const rows = [createRow('a | b')];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| a \\| b |\n| :-- |');
  });

  /* Escaping the pipe alone would serialize this as `a \\| b`, where GFM reads
     `\\` as one backslash and then splits the row on the bare pipe. */
  it('escapes a backslash in cell text before the pipe it precedes', () => {
    const rows = [createRow('a \\| b')];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| a \\\\\\| b |\n| :-- |');
  });

  it('escapes a backslash in cell text that no pipe follows', () => {
    const rows = [createRow('C:\\path')];

    expect(
      serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Markdown),
    ).toBe('| C:\\\\path |\n| :-- |');
  });

  it('keeps a formula inline with the prose around it', () => {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.innerHTML =
      `holds for <span class="katex"><math><semantics><mrow><mi>α</mi></mrow>` +
      `<annotation encoding="application/x-tex">\\alpha</annotation>` +
      `</semantics></math></span> only`;
    row.appendChild(cell);

    expect(
      serializeMarkdownTableRows([row], MarkdownTableCopyFormat.Markdown),
    ).toBe('| holds for $$\\alpha$$ only |\n| :-- |');
  });

  it('escapes the prose around a formula without touching its LaTeX', () => {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.innerHTML =
      `a | b <span class="katex"><math><semantics><mrow><mi>α</mi></mrow>` +
      `<annotation encoding="application/x-tex">\\alpha</annotation>` +
      `</semantics></math></span>`;
    row.appendChild(cell);

    expect(
      serializeMarkdownTableRows([row], MarkdownTableCopyFormat.Markdown),
    ).toBe('| a \\| b $$\\alpha$$ |\n| :-- |');
  });

  it('falls back to the rendered text when KaTeX left no annotation', () => {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.innerHTML = '<span class="katex"><math><mi>x</mi></math></span>';
    row.appendChild(cell);

    expect(
      serializeMarkdownTableRows([row], MarkdownTableCopyFormat.Markdown),
    ).toBe('| x |\n| :-- |');
  });
});
