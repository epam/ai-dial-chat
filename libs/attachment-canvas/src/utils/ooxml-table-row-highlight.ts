import type { DocxTextRunInfo } from '@silurus/ooxml/docx';
import type { PptxTextRunInfo } from '@silurus/ooxml/pptx';
import type {
  OoxmlDocxTableRowLocation,
  OoxmlPptxTableRowLocation,
} from '../models/attachment-canvas';
import { OoxmlHighlightKind } from '../types/attachment-canvas';
import {
  type OoxmlDocxPageRects,
  type OoxmlDocxPageRuns,
  type OoxmlHighlightRect,
  resolveDocxRects,
  resolvePptxRects,
} from './ooxml-highlight-geometry';

/*
 * TODO(#8863): Remove text-based table-row resolution after the backend emits
 * precise cell ranges and persisted anchors no longer need the workaround.
 * https://github.com/epam/ai-dial-chat/issues/8863
 * Only whole rows with matching cell boundaries qualify; no document-wide
 * substring search or fallback for stale structural ranges is performed.
 */
const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

const matchesRow = <TRun>(
  cells: Map<number, TRun[]>,
  expected: readonly string[],
  textOf: (runs: TRun[]) => string,
): boolean =>
  expected.length > 1 &&
  expected.some((text) => normalizeWhitespace(text) !== '') &&
  [...cells.keys()].every(
    (column) => column >= 0 && column < expected.length,
  ) &&
  expected.every(
    (text, column) =>
      normalizeWhitespace(textOf(cells.get(column) ?? [])) ===
      normalizeWhitespace(text),
  );

const addToCell = <TRun>(
  rows: Map<string, Map<number, TRun[]>>,
  key: string,
  column: number,
  run: TRun,
): void => {
  let cells = rows.get(key);
  if (cells == null) {
    cells = new Map();
    rows.set(key, cells);
  }
  const runs = cells.get(column);
  if (runs == null) cells.set(column, [run]);
  else runs.push(run);
};

interface DocxRowRun {
  run: DocxTextRunInfo;
  pageIndex: number;
}

const docxCellText = (runs: DocxRowRun[]): string => {
  let text = '';
  let previous: DocxRowRun | undefined;
  for (const entry of runs) {
    if (
      previous != null &&
      (entry.pageIndex !== previous.pageIndex ||
        entry.run.y !== previous.run.y ||
        entry.run.source?.path.at(-1) !== previous.run.source?.path.at(-1))
    ) {
      text += ' ';
    }
    text += entry.run.text;
    previous = entry;
  }
  return text;
};

/** Resolves a whole DOCX table row to scale-independent text rectangles. */
export const resolveDocxTableRowRects = (
  location: OoxmlDocxTableRowLocation,
  pages: readonly OoxmlDocxPageRuns[],
): OoxmlDocxPageRects[] => {
  if (!Number.isSafeInteger(location.occurrence) || location.occurrence < 1) {
    return [];
  }
  const rows = new Map<string, Map<number, DocxRowRun[]>>();
  for (const { pageIndex, runs } of pages) {
    for (const run of runs) {
      const source = run.source;
      if (source?.story !== 'body' || run.sourceRunIndex == null) continue;
      /* A table paragraph path ends in [table, row, cell, paragraph].
       * Nested tables repeat [table, row, cell] before that final paragraph. */
      if (source.path.length < 4 || (source.path.length - 1) % 3 !== 0)
        continue;
      const key = JSON.stringify([
        source.storyInstance,
        source.path.slice(0, -2),
      ]);
      const column = source.path.at(-2);
      if (column == null) continue;
      addToCell(rows, key, column, { run, pageIndex });
    }
  }

  let occurrence = 0;
  for (const cells of rows.values()) {
    if (!matchesRow(cells, location.cells, docxCellText)) continue;
    occurrence += 1;
    if (occurrence !== location.occurrence) continue;

    const paragraphs = new Map<string, DocxTextRunInfo[]>();
    for (const column of [...cells.keys()].sort(
      (left, right) => left - right,
    )) {
      for (const { run } of cells.get(column) ?? []) {
        const key = JSON.stringify(run.source?.path);
        const runs = paragraphs.get(key);
        if (runs == null) paragraphs.set(key, [run]);
        else runs.push(run);
      }
    }

    const result = new Map<number, OoxmlDocxPageRects>();
    for (const runs of paragraphs.values()) {
      const source = runs[0].source;
      if (source == null) continue;
      const text = runs.map((run) => run.text).join('');
      const selected = new Set(runs);
      for (const page of resolveDocxRects({
        location: {
          kind: OoxmlHighlightKind.DocxTextRange,
          story: source.story,
          path: [...source.path],
          start: 0,
          endExclusive: text.length,
          text,
        },
        pages: pages.map((page) => ({
          ...page,
          runs: page.runs.filter((run) => selected.has(run)),
        })),
      })) {
        const existing = result.get(page.pageIndex);
        if (existing == null) result.set(page.pageIndex, page);
        else existing.rects.push(...page.rects);
      }
    }
    return [...result.values()].sort(
      (left, right) => left.pageIndex - right.pageIndex,
    );
  }
  return [];
};

const pptxCellText = (runs: PptxTextRunInfo[]): string => {
  let text = '';
  let previous: PptxTextRunInfo | undefined;
  for (const run of runs) {
    // The renderer may drop the space at a soft line wrap.
    if (previous != null && run.inShapeY !== previous.inShapeY) text += ' ';
    text += run.text;
    previous = run;
  }
  return text;
};

/** Resolves a whole table row from the runs of its specified PPTX slide. */
export const resolvePptxTableRowRects = (
  location: OoxmlPptxTableRowLocation,
  runs: readonly PptxTextRunInfo[],
): OoxmlHighlightRect[] => {
  if (!Number.isSafeInteger(location.occurrence) || location.occurrence < 1) {
    return [];
  }
  const rows = new Map<string, Map<number, PptxTextRunInfo[]>>();
  for (const run of runs) {
    if (
      run.tableCell == null ||
      run.shapeId == null ||
      run.origin === 'master' ||
      run.origin === 'layout'
    ) {
      continue;
    }
    const key = JSON.stringify([
      run.elementIndex,
      run.shapeId,
      run.tableCell.row,
    ]);
    addToCell(rows, key, run.tableCell.column, run);
  }

  let occurrence = 0;
  for (const cells of rows.values()) {
    if (!matchesRow(cells, location.cells, pptxCellText)) continue;
    occurrence += 1;
    if (occurrence !== location.occurrence) continue;

    return [...cells.values()].flatMap((cellRuns) => {
      const text = cellRuns.map((run) => run.text).join('');
      return resolvePptxRects({
        location: {
          kind: OoxmlHighlightKind.PptxTextRange,
          slide: location.slide,
          shapeId: String(cellRuns[0].shapeId),
          start: 0,
          endExclusive: text.length,
          text,
        },
        runs: cellRuns,
      });
    });
  }
  return [];
};
