import type { DocxTextRunInfo } from '@silurus/ooxml/docx';
import type { PptxTextRunInfo } from '@silurus/ooxml/pptx';
import { describe, expect, it, vi } from 'vitest';
import type {
  OoxmlDocxHighlightLocation,
  OoxmlPptxHighlightLocation,
  OoxmlXlsxHighlightLocation,
} from '../../models/attachment-canvas';
import { OoxmlHighlightKind } from '../../types/attachment-canvas';
import {
  docxPageSizePx,
  mergeSameLineRects,
  type OoxmlHighlightRect,
  pptxSlideSizePx,
  resolveDocxRects,
  resolvePptxRects,
  resolveSurfaceOffset,
  resolveXlsxRects,
  resolveXlsxSheetIndex,
  toXlsxCellRef,
} from '../ooxml-highlight-geometry';

/*
 * A deliberately non-uniform font: `i` is one pixel wide and every other glyph
 * is ten. It makes the difference between measuring a partial run and
 * interpolating on character count impossible to miss.
 */
const measure = vi.fn((_font: string, text: string) =>
  [...text].reduce((width, char) => width + (char === 'i' ? 1 : 10), 0),
);

const docxRun = (
  overrides: Partial<DocxTextRunInfo> & { text: string },
): DocxTextRunInfo => ({
  source: { story: 'body', storyInstance: 'main', path: [3, 1] },
  sourceRunIndex: 0,
  x: 0,
  y: 100,
  w: [...overrides.text].length * 10,
  h: 12,
  fontSize: 12,
  font: '12px Arial',
  ...overrides,
});

const docxLocation = (
  overrides: Partial<OoxmlDocxHighlightLocation> = {},
): OoxmlDocxHighlightLocation => ({
  kind: OoxmlHighlightKind.DocxTextRange,
  story: 'body',
  path: [3, 1],
  start: 0,
  endExclusive: 5,
  text: 'Hello',
  ...overrides,
});

const pptxRun = (
  overrides: Partial<PptxTextRunInfo> & { text: string },
): PptxTextRunInfo => ({
  shapeId: '7',
  origin: 'slide',
  inShapeX: 5,
  inShapeY: 3,
  shapeX: 100,
  shapeY: 200,
  shapeW: 400,
  shapeH: 80,
  w: [...overrides.text].length * 10,
  h: 14,
  fontSize: 14,
  font: '14px Arial',
  rotation: 0,
  ...overrides,
});

const pptxLocation = (
  overrides: Partial<OoxmlPptxHighlightLocation> = {},
): OoxmlPptxHighlightLocation => ({
  kind: OoxmlHighlightKind.PptxTextRange,
  slide: 1,
  shapeId: '7',
  start: 0,
  endExclusive: 5,
  text: 'Hello',
  ...overrides,
});

const xlsxLocation = (
  overrides: Partial<OoxmlXlsxHighlightLocation> = {},
): OoxmlXlsxHighlightLocation => ({
  kind: OoxmlHighlightKind.XlsxCellRange,
  sheet: 'Q3',
  start: { row: 14, col: 3 },
  ...overrides,
});

const cellRect = (col: number): OoxmlHighlightRect => ({
  left: col * 80,
  top: 300,
  width: 80,
  height: 20,
});

describe('resolveSurfaceOffset', () => {
  it('stacks pages by height, gap, and leading padding', () => {
    const offset = resolveSurfaceOffset({
      index: 2,
      sizeAt: () => ({ width: 816, height: 1056 }),
      hostClientWidth: 1000,
      layout: { gap: 20, paddingTop: 30, paddingLeft: 8 },
    });

    expect(offset.top).toBe(30 + 2 * 1056 + 2 * 20);
    expect(offset.left).toBe((1000 - 816) / 2);
  });

  it('falls back to the vendor gap default for padding', () => {
    const offset = resolveSurfaceOffset({
      index: 1,
      sizeAt: () => ({ width: 100, height: 200 }),
      hostClientWidth: 100,
      layout: { gap: 16 },
    });

    expect(offset.top).toBe(16 + 200 + 16);
  });

  it('never centres a page closer than the leading padding', () => {
    const offset = resolveSurfaceOffset({
      index: 0,
      sizeAt: () => ({ width: 1200, height: 200 }),
      hostClientWidth: 600,
      layout: { gap: 16, paddingLeft: 8 },
    });

    expect(offset.left).toBe(8);
  });
});

describe('docxPageSizePx / pptxSlideSizePx', () => {
  it('converts points to CSS pixels at the given scale', () => {
    expect(docxPageSizePx({ widthPt: 612, heightPt: 792 }, 1.5)).toEqual({
      width: 612 * (4 / 3) * 1.5,
      height: 792 * (4 / 3) * 1.5,
    });
  });

  it('converts EMU to CSS pixels at the given scale', () => {
    expect(pptxSlideSizePx(12192000, 6858000, 0.5)).toEqual({
      width: (12192000 / 9525) * 0.5,
      height: (6858000 / 9525) * 0.5,
    });
  });
});

describe('mergeSameLineRects', () => {
  it('merges touching rectangles on one visual line', () => {
    const merged = mergeSameLineRects([
      { left: 0, top: 100, width: 10, height: 12 },
      { left: 10, top: 100, width: 10, height: 12 },
      { left: 20, top: 100, width: 10, height: 12 },
    ]);

    expect(merged).toEqual([{ left: 0, top: 100, width: 30, height: 12 }]);
  });

  it('keeps rectangles on different lines apart', () => {
    const merged = mergeSameLineRects([
      { left: 0, top: 100, width: 10, height: 12 },
      { left: 0, top: 120, width: 10, height: 12 },
    ]);

    expect(merged).toHaveLength(2);
  });
});

describe('resolveDocxRects', () => {
  it('contributes only runs whose path matches element-wise', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        {
          pageIndex: 0,
          runs: [
            docxRun({ text: 'Hello', x: 0 }),
            docxRun({
              text: 'Other',
              x: 200,
              source: { story: 'body', storyInstance: 'main', path: [4, 0] },
            }),
          ],
        },
      ],
      measure,
    });

    expect(rects).toEqual([
      { pageIndex: 0, rects: [{ left: 0, top: 100, width: 50, height: 12 }] },
    ]);
  });

  it('excludes a synthesized run with no source from geometry and from offsets', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        {
          pageIndex: 0,
          runs: [
            docxRun({ text: 'Page 1', x: 500, source: undefined }),
            docxRun({ text: 'Hello', x: 0 }),
          ],
        },
      ],
      measure,
    });

    /* The header run neither draws nor shifts the offsets: `Hello` still starts
     * at character 0. */
    expect(rects).toEqual([
      { pageIndex: 0, rects: [{ left: 0, top: 100, width: 50, height: 12 }] },
    ]);
  });

  it('excludes a run with no sourceRunIndex', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        {
          pageIndex: 0,
          runs: [docxRun({ text: 'Hello', x: 0, sourceRunIndex: undefined })],
        },
      ],
      measure,
    });

    expect(rects).toEqual([]);
  });

  it('measures a partial run instead of interpolating on character count', () => {
    const text = 'iiiWWWWWWW';
    const rects = resolveDocxRects({
      location: docxLocation({
        start: 0,
        endExclusive: 3,
        text: 'iii',
      }),
      pages: [{ pageIndex: 0, runs: [docxRun({ text, x: 0, w: 73 })] }],
      measure,
    });

    const [{ rects: pageRects }] = rects;
    /* Measured: three `i` glyphs are 3px. Interpolated on character count it
     * would be three tenths of the run's 73px box, i.e. 21.9px. */
    expect(pageRects[0].width).toBe(3);
    expect(pageRects[0].width).not.toBeCloseTo(21.9);
  });

  it('merges three consecutive runs on one visual line into one rectangle', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 9, text: 'abcdefghi' }),
      pages: [
        {
          pageIndex: 0,
          runs: [
            docxRun({ text: 'abc', x: 0, w: 30 }),
            docxRun({ text: 'def', x: 30, w: 30 }),
            docxRun({ text: 'ghi', x: 60, w: 30 }),
          ],
        },
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      { left: 0, top: 100, width: 90, height: 12 },
    ]);
  });

  it('keeps a range wrapping across a line break as two rectangles', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 6, text: 'abcdef' }),
      pages: [
        {
          pageIndex: 0,
          runs: [
            docxRun({ text: 'abc', x: 0, y: 100, w: 30 }),
            docxRun({ text: 'def', x: 0, y: 120, w: 30 }),
          ],
        },
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      { left: 0, top: 100, width: 30, height: 12 },
      { left: 0, top: 120, width: 30, height: 12 },
    ]);
  });

  it('produces one rectangle group per page when a range spans a page boundary', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 6, text: 'abcdef' }),
      pages: [
        { pageIndex: 3, runs: [docxRun({ text: 'abc', x: 0, w: 30 })] },
        { pageIndex: 4, runs: [docxRun({ text: 'def', x: 0, w: 30 })] },
      ],
      measure,
    });

    expect(rects.map(({ pageIndex }) => pageIndex)).toEqual([3, 4]);
    expect(rects).toHaveLength(2);
  });

  it('skips a transformed run while still counting its characters', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 6, text: 'abcdef' }),
      pages: [
        {
          pageIndex: 0,
          runs: [
            docxRun({ text: 'abc', x: 0, w: 30, transform: 'rotate(3deg)' }),
            docxRun({ text: 'def', x: 30, w: 30 }),
          ],
        },
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      { left: 30, top: 100, width: 30, height: 12 },
    ]);
  });

  it('prefers highlightBounds over the run box', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        {
          pageIndex: 0,
          runs: [
            docxRun({
              text: 'Hello',
              x: 0,
              y: 100,
              highlightBounds: { x: 7, y: 98, width: 55, height: 16 },
            }),
          ],
        },
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      { left: 7, top: 98, width: 55, height: 16 },
    ]);
  });

  it('draws nothing when the resolved text disagrees with the selector text', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ text: 'Goodbye' }),
      pages: [{ pageIndex: 0, runs: [docxRun({ text: 'Hello', x: 0 })] }],
      measure,
    });

    expect(rects).toEqual([]);
  });

  it('draws nothing, and does not throw, when endExclusive is past the resolved text', () => {
    expect(() =>
      resolveDocxRects({
        location: docxLocation({ start: 0, endExclusive: 99, text: 'Hello' }),
        pages: [{ pageIndex: 0, runs: [docxRun({ text: 'Hello', x: 0 })] }],
        measure,
      }),
    ).not.toThrow();

    expect(
      resolveDocxRects({
        location: docxLocation({ start: 0, endExclusive: 99, text: 'Hello' }),
        pages: [{ pageIndex: 0, runs: [docxRun({ text: 'Hello', x: 0 })] }],
        measure,
      }),
    ).toEqual([]);
  });

  it('uses run coordinates as returned, applying no second scale pass', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        { pageIndex: 0, runs: [docxRun({ text: 'Hello', x: 240, y: 480 })] },
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      { left: 240, top: 480, width: 50, height: 12 },
    ]);
  });
});

describe('resolvePptxRects', () => {
  it('composes the shape position with the run offset inside it', () => {
    const rects = resolvePptxRects({
      location: pptxLocation(),
      runs: [pptxRun({ text: 'Hello' })],
      measure,
    });

    expect(rects).toEqual([{ left: 105, top: 203, width: 50, height: 14 }]);
  });

  it('matches a shape id that only stringifies equal', () => {
    const rects = resolvePptxRects({
      location: pptxLocation({ shapeId: '7' }),
      runs: [pptxRun({ text: 'Hello', shapeId: 7 as unknown as string })],
      measure,
    });

    expect(rects).toHaveLength(1);
  });

  it('ignores a non-matching shape on the right slide', () => {
    const rects = resolvePptxRects({
      location: pptxLocation({ shapeId: '7' }),
      runs: [pptxRun({ text: 'Hello', shapeId: '9' })],
      measure,
    });

    expect(rects).toEqual([]);
  });

  it('excludes a run with no shape id', () => {
    const rects = resolvePptxRects({
      location: pptxLocation(),
      runs: [pptxRun({ text: 'Hello', shapeId: undefined })],
      measure,
    });

    expect(rects).toEqual([]);
  });

  it('excludes layout and master template text', () => {
    const rects = resolvePptxRects({
      location: pptxLocation(),
      runs: [pptxRun({ text: 'Hello', origin: 'layout' })],
      measure,
    });

    expect(rects).toEqual([]);
  });

  it('measures a partial run inside a shape', () => {
    const rects = resolvePptxRects({
      location: pptxLocation({ start: 0, endExclusive: 3, text: 'iii' }),
      runs: [pptxRun({ text: 'iiiWWWWWWW', w: 73 })],
      measure,
    });

    expect(rects[0].width).toBe(3);
  });

  it.each([
    ['rotation', { rotation: 45 }],
    ['textBodyRotation', { textBodyRotation: 90 }],
    ['shapeFlipH', { shapeFlipH: true }],
    ['shapeFlipV', { shapeFlipV: true }],
  ])('draws nothing for a shape reporting %s', (_name, overrides) => {
    const rects = resolvePptxRects({
      location: pptxLocation(),
      runs: [pptxRun({ text: 'Hello', ...overrides })],
      measure,
    });

    expect(rects).toEqual([]);
  });

  it('draws nothing when the resolved text disagrees with the selector text', () => {
    const rects = resolvePptxRects({
      location: pptxLocation({ text: 'Goodbye' }),
      runs: [pptxRun({ text: 'Hello' })],
      measure,
    });

    expect(rects).toEqual([]);
  });
});

describe('resolveXlsxSheetIndex', () => {
  it('finds a sheet by exact name', () => {
    expect(resolveXlsxSheetIndex('Q3', ['Summary', 'Q3'])).toBe(1);
  });

  it('does not match a name differing only in case', () => {
    expect(resolveXlsxSheetIndex('q3', ['Summary', 'Q3'])).toBeNull();
  });

  it('returns null for an unknown sheet', () => {
    expect(resolveXlsxSheetIndex('Q5', ['Summary', 'Q3'])).toBeNull();
  });
});

describe('toXlsxCellRef', () => {
  it.each([
    [{ row: 14, col: 3 }, 'C14'],
    [{ row: 1, col: 1 }, 'A1'],
    [{ row: 2, col: 27 }, 'AA2'],
  ])('renders %o as %s', (address, expected) => {
    expect(toXlsxCellRef(address)).toBe(expected);
  });
});

describe('resolveXlsxRects', () => {
  it('passes 1-based selector coordinates through unconverted', () => {
    const getCellViewportRect = vi.fn(() => cellRect(3));

    resolveXlsxRects({
      location: xlsxLocation(),
      getCellViewportRect,
    });

    expect(getCellViewportRect).toHaveBeenCalledWith({ row: 14, col: 3 });
  });

  it('merges a same-row column span into one rectangle', () => {
    const rects = resolveXlsxRects({
      location: xlsxLocation({ end: { row: 14, col: 6 } }),
      getCellViewportRect: ({ col }) => cellRect(col),
    });

    expect(rects).toEqual([
      { left: 3 * 80, top: 300, width: 4 * 80, height: 20 },
    ]);
  });

  it('draws nothing when the viewer reports the cell unmeasurable', () => {
    const rects = resolveXlsxRects({
      location: xlsxLocation(),
      getCellViewportRect: () => null,
    });

    expect(rects).toEqual([]);
  });

  it('rejects a multi-row range', () => {
    const rects = resolveXlsxRects({
      location: xlsxLocation({ end: { row: 18, col: 6 } }),
      getCellViewportRect: ({ col }) => cellRect(col),
    });

    expect(rects).toEqual([]);
  });

  it('clips a range wider than the viewport and leaves its trailing edge open', () => {
    const [rect] = resolveXlsxRects({
      location: xlsxLocation({
        start: { row: 14, col: 1 },
        end: { row: 14, col: 9 },
      }),
      getCellViewportRect: ({ col }) => cellRect(col),
      viewportWidth: 400,
    });

    expect(rect.left).toBe(80);
    expect(rect.left + rect.width).toBe(400);
    expect(rect.isClippedAtEnd).toBe(true);
  });
});
