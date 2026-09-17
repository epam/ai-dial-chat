import type { DocxTextRunInfo } from '@silurus/ooxml/docx';
import type { PptxTextRunInfo } from '@silurus/ooxml/pptx';
import { describe, expect, it } from 'vitest';
import { OoxmlHighlightKind } from '../../types/attachment-canvas';
import { type OoxmlDocxPageRuns } from '../ooxml-highlight-geometry';
import {
  resolveDocxTableRowRects,
  resolvePptxTableRowRects,
} from '../ooxml-table-row-highlight';

const docxRun = (
  text: string,
  row: number,
  column: number,
  overrides: Partial<DocxTextRunInfo> = {},
): DocxTextRunInfo => ({
  text,
  source: { story: 'body', storyInstance: 'body', path: [29, row, column, 0] },
  sourceRunIndex: 0,
  x: column * 100,
  y: row * 30,
  w: 50,
  h: 10,
  font: '12px Arial',
  fontSize: 12,
  ...overrides,
});

const docxPage = (
  runs: DocxTextRunInfo[],
  pageIndex = 3,
): OoxmlDocxPageRuns => ({
  pageIndex,
  runs,
  pageBox: { width: 500, height: 1000 },
});

const pptxRun = (
  text: string,
  row: number,
  column: number,
  overrides: Partial<PptxTextRunInfo> = {},
): PptxTextRunInfo => ({
  text,
  elementIndex: 2,
  shapeId: '3',
  origin: 'slide',
  tableCell: { row, column },
  shapeX: 10,
  shapeY: 20,
  shapeW: 600,
  shapeH: 400,
  inShapeX: column * 100,
  inShapeY: row * 30,
  w: 50,
  h: 10,
  font: '12px Arial',
  fontSize: 12,
  rotation: 0,
  ...overrides,
});

const docxLocation = {
  kind: OoxmlHighlightKind.DocxTableRow as const,
  cells: ['Latency budget', 'Platform', 'Raise capacity review'],
  occurrence: 1,
};
const pptxLocation = {
  kind: OoxmlHighlightKind.PptxTableRow as const,
  cells: [
    'Latency budget',
    'Platform',
    'PPTX_TABLE_TARGET_BRAVO: Raise capacity review',
  ],
  occurrence: 1,
  slide: 2,
};

describe('DOCX table row geometry', () => {
  const row = (index: number) =>
    docxLocation.cells.map((text, column) => docxRun(text, index, column));

  it('highlights each cited cell on the later page without spanning the gaps or adjacent row', () => {
    const result = resolveDocxTableRowRects(docxLocation, [
      docxPage([], 0),
      docxPage([
        ...row(0).map((run) => ({ ...run, text: 'unrelated' })),
        ...row(1),
      ]),
    ]);
    expect(result).toEqual([
      {
        pageIndex: 3,
        rects: [
          { left: 0, top: 0.03, width: 0.1, height: 0.01 },
          { left: 0.2, top: 0.03, width: 0.1, height: 0.01 },
          { left: 0.4, top: 0.03, width: 0.1, height: 0.01 },
        ],
      },
    ]);
  });

  it('counts matching rows across pages using a 1-based occurrence', () => {
    const pages = [docxPage(row(1), 1), docxPage(row(2), 4)];
    expect(
      resolveDocxTableRowRects({ ...docxLocation, occurrence: 2 }, pages).map(
        (page) => page.pageIndex,
      ),
    ).toEqual([4]);
    expect(
      resolveDocxTableRowRects({ ...docxLocation, occurrence: 3 }, pages),
    ).toEqual([]);
  });

  it('joins wrapped text and paragraphs inside a cell, including across pages', () => {
    const first = [
      docxRun('Latency ', 1, 0),
      docxRun('budget', 1, 0, { y: 42 }),
      docxRun('Platform', 1, 1),
      docxRun('Raise capacity', 1, 2),
    ];
    const second = [
      docxRun('review', 1, 2, {
        source: { story: 'body', storyInstance: 'body', path: [29, 1, 2, 1] },
      }),
    ];
    expect(
      resolveDocxTableRowRects(docxLocation, [
        docxPage(first),
        docxPage(second, 4),
      ]).map((page) => page.pageIndex),
    ).toEqual([3, 4]);
  });

  it('does not combine cells from different rows or tables', () => {
    expect(
      resolveDocxTableRowRects(docxLocation, [
        docxPage([
          docxRun('Latency budget', 1, 0),
          docxRun('Platform', 2, 1),
          docxRun('Raise capacity review', 1, 2),
        ]),
      ]),
    ).toEqual([]);
    expect(
      resolveDocxTableRowRects(docxLocation, [
        docxPage(
          row(1).map((run, index) =>
            index !== 1
              ? run
              : {
                  ...run,
                  source: {
                    story: 'body',
                    storyInstance: 'body',
                    path: [30, 1, 1, 0],
                  },
                },
          ),
        ),
      ]),
    ).toEqual([]);
  });

  it('rejects partial, stale or extra-cell matches and excludes synthetic or transformed text', () => {
    for (const runs of [
      row(1).slice(0, 2),
      [...row(1), docxRun('extra cell', 1, 3)],
      row(1).map((run) => ({ ...run, text: `prefix ${run.text}` })),
      row(1).map((run) => ({ ...run, sourceRunIndex: undefined })),
      row(1).map((run) => ({ ...run, transform: 'rotate(90deg)' })),
    ]) {
      expect(resolveDocxTableRowRects(docxLocation, [docxPage(runs)])).toEqual(
        [],
      );
    }
  });
});

describe('PPTX table row geometry', () => {
  const row = (index: number) =>
    pptxLocation.cells.map((text, column) => pptxRun(text, index, column));

  it('restores a dropped line-wrap space and returns text boxes for all cited cells', () => {
    const runs = [
      ...row(0).map((run) => ({ ...run, text: 'unrelated' })),
      pptxRun('Latency budget', 1, 0),
      pptxRun('Platform', 1, 1),
      pptxRun('PPTX_TABLE_TARGET_BRAVO: Raise capacity', 1, 2),
      pptxRun('review', 1, 2, { inShapeY: 45 }),
    ];
    expect(resolvePptxTableRowRects(pptxLocation, runs)).toEqual([
      { left: 10, top: 50, width: 50, height: 10 },
      { left: 110, top: 50, width: 50, height: 10 },
      { left: 210, top: 50, width: 50, height: 10 },
      { left: 210, top: 65, width: 50, height: 10 },
    ]);
  });

  it('selects only the requested occurrence on the supplied slide', () => {
    const runs = [...row(1), ...row(2)];
    expect(
      resolvePptxTableRowRects({ ...pptxLocation, occurrence: 2 }, runs).map(
        (rect) => rect.top,
      ),
    ).toEqual([80, 80, 80]);
    expect(
      resolvePptxTableRowRects({ ...pptxLocation, occurrence: 3 }, runs),
    ).toEqual([]);
  });

  it('does not stitch different shapes, rows, or non-table text into a match', () => {
    for (const overrides of [
      { shapeId: 'different' },
      { elementIndex: 4 },
      { tableCell: { row: 2, column: 1 } },
      { tableCell: undefined },
    ]) {
      expect(
        resolvePptxTableRowRects(
          pptxLocation,
          row(1).map((run, index) =>
            index === 1 ? { ...run, ...overrides } : run,
          ),
        ),
      ).toEqual([]);
    }
  });

  it('does not highlight master/layout text, rotated shapes, or stale text', () => {
    for (const overrides of [
      { origin: 'master' as const },
      { origin: 'layout' as const },
      { rotation: 15 },
      { shapeFlipH: true },
      { text: 'stale' },
    ]) {
      expect(
        resolvePptxTableRowRects(
          pptxLocation,
          row(1).map((run) => ({ ...run, ...overrides })),
        ),
      ).toEqual([]);
    }
  });
});
