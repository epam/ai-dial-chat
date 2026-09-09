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

  it('serializes TXT rows with tabs and trimmed cell text', () => {
    const rows = [
      createRow(' Name ', ' Value '),
      createRow(' Alpha ', ' 1 '),
      createRow(' Beta ', ' 2 '),
    ];

    expect(serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Txt)).toBe(
      'Name\tValue\nAlpha\t1\nBeta\t2',
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
    expect(serializeMarkdownTableRows(rows, MarkdownTableCopyFormat.Txt)).toBe(
      '\tValue',
    );
  });
});
