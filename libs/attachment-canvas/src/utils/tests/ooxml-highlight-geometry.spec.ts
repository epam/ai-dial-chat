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
  type OoxmlDocxNormalizedRect,
  type OoxmlHighlightRect,
  type OoxmlScrollHostBox,
  pptxSlideSizePx,
  resolveDocxRects,
  resolveDocxScrollTarget,
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

describe('resolveDocxScrollTarget', () => {
  /* US-Letter page at scale 1: 612pt x 792pt -> 816 x 1056 CSS px. */
  const pageSizeAt = (scale: number) => (_index: number) => ({
    width: 816 * scale,
    height: 1056 * scale,
  });

  const docxRect = (
    overrides: Partial<OoxmlDocxNormalizedRect> = {},
  ): OoxmlDocxNormalizedRect => ({
    left: 0.1,
    top: 0.1,
    width: 0.3,
    height: 0.03,
    ...overrides,
  });

  const hostBox = (
    overrides: Partial<OoxmlScrollHostBox> = {},
  ): OoxmlScrollHostBox => ({
    clientWidth: 900,
    clientHeight: 600,
    scrollWidth: 900,
    scrollHeight: 3200,
    scrollLeft: 0,
    ...overrides,
  });

  it('places a mid-page rectangle with leading context above it', () => {
    const target = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ top: 0.5 }),
      sizeAt: pageSizeAt(1),
      host: hostBox(),
      layout: { gap: 16 },
    });

    const offset = resolveSurfaceOffset({
      index: 0,
      sizeAt: pageSizeAt(1),
      hostClientWidth: 900,
      layout: { gap: 16 },
    });
    const rectTop = offset.top + 0.5 * 1056;
    expect(target.top).toBe(rectTop - 600 * 0.25);
  });

  it('scales proportionally at a non-default scale', () => {
    const targetAt1 = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ top: 0.5 }),
      sizeAt: pageSizeAt(1),
      host: hostBox(),
      layout: { gap: 16 },
    });
    const targetAt2 = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ top: 0.5 }),
      sizeAt: pageSizeAt(2),
      host: hostBox({ scrollHeight: 6400 }),
      layout: { gap: 16 },
    });

    /* Same fraction of a page twice the size lands roughly twice as far down,
     * modulo the constant gap and lead margin which do not scale. */
    expect(targetAt2.top).toBeGreaterThan(targetAt1.top * 1.5);
  });

  it('accounts for gap and preceding page heights on a later page', () => {
    const target = resolveDocxScrollTarget({
      pageIndex: 3,
      rect: docxRect({ top: 0.5 }),
      sizeAt: pageSizeAt(1),
      host: hostBox({ scrollHeight: 5000 }),
      layout: { gap: 16 },
    });

    const offset = resolveSurfaceOffset({
      index: 3,
      sizeAt: pageSizeAt(1),
      hostClientWidth: 900,
      layout: { gap: 16 },
    });
    const rectTop = offset.top + 0.5 * 1056;
    expect(target.top).toBe(rectTop - 600 * 0.25);
    expect(offset.top).toBe(16 + 3 * 16 + 3 * 1056);
  });

  it('clamps to zero when the lead margin would push the target negative', () => {
    const target = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ top: 0.01 }),
      sizeAt: pageSizeAt(1),
      host: hostBox(),
      layout: { gap: 16 },
    });

    expect(target.top).toBe(0);
  });

  it('clamps to the host max scroll when the target would exceed it', () => {
    const target = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ top: 0.99 }),
      sizeAt: pageSizeAt(1),
      host: hostBox({ scrollHeight: 1100, clientHeight: 600 }),
      layout: { gap: 16 },
    });

    expect(target.top).toBe(1100 - 600);
  });

  it('aligns the passage start when the passage is taller than the viewport', () => {
    const target = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ top: 0.4, height: 0.8 }),
      sizeAt: pageSizeAt(1),
      host: hostBox({ clientHeight: 400, scrollHeight: 3200 }),
      layout: { gap: 16 },
    });

    const offset = resolveSurfaceOffset({
      index: 0,
      sizeAt: pageSizeAt(1),
      hostClientWidth: 900,
      layout: { gap: 16 },
    });
    const rectTop = offset.top + 0.4 * 1056;
    expect(target.top).toBe(rectTop - 400 * 0.25);
  });

  it('leaves horizontal position unchanged when the rectangle is already in view', () => {
    const target = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ left: 0.1, width: 0.2 }),
      sizeAt: pageSizeAt(1),
      host: hostBox({ scrollLeft: 0 }),
      layout: { gap: 16 },
    });

    expect(target.left).toBe(0);
  });

  it('shifts horizontal position just enough to reveal a rectangle left of view', () => {
    const target = resolveDocxScrollTarget({
      pageIndex: 0,
      rect: docxRect({ left: 0.01, width: 0.1 }),
      sizeAt: pageSizeAt(1),
      host: hostBox({ scrollLeft: 200, clientWidth: 300 }),
      layout: { gap: 16, paddingLeft: 8 },
    });

    const offset = resolveSurfaceOffset({
      index: 0,
      sizeAt: pageSizeAt(1),
      hostClientWidth: 300,
      layout: { gap: 16, paddingLeft: 8 },
    });
    const rectLeft = offset.left + 0.01 * 816;
    expect(target.left).toBe(rectLeft);
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

/*
 * The reference page box every DOCX test resolves against: the scale-1 CSS
 * size of a 612pt × 792pt page (`612 * 4/3`, `792 * 4/3`) — the same box
 * `createDocxHighlightSurface` derives from the document and collects runs
 * at. `resolveDocxRects` divides by this box, so every expected value below
 * is written as `<pixels> / PAGE_BOX.<dimension>` rather than a decimal
 * literal, to keep the fraction visibly tied to the pixel geometry it comes
 * from.
 */
const PAGE_BOX = { width: (612 * 4) / 3, height: (792 * 4) / 3 };

const docxPage = (
  pageIndex: number,
  runs: DocxTextRunInfo[],
  pageBox = PAGE_BOX,
) => ({ pageIndex, runs, pageBox });

describe('resolveDocxRects', () => {
  it('contributes only runs whose path matches element-wise', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        docxPage(0, [
          docxRun({ text: 'Hello', x: 0 }),
          docxRun({
            text: 'Other',
            x: 200,
            source: { story: 'body', storyInstance: 'main', path: [4, 0] },
          }),
        ]),
      ],
      measure,
    });

    expect(rects).toEqual([
      {
        pageIndex: 0,
        rects: [
          {
            left: 0 / PAGE_BOX.width,
            top: 100 / PAGE_BOX.height,
            width: 50 / PAGE_BOX.width,
            height: 12 / PAGE_BOX.height,
          },
        ],
      },
    ]);
  });

  it('excludes a synthesized run with no source from geometry and from offsets', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        docxPage(0, [
          docxRun({ text: 'Page 1', x: 500, source: undefined }),
          docxRun({ text: 'Hello', x: 0 }),
        ]),
      ],
      measure,
    });

    /* The header run neither draws nor shifts the offsets: `Hello` still starts
     * at character 0. */
    expect(rects).toEqual([
      {
        pageIndex: 0,
        rects: [
          {
            left: 0 / PAGE_BOX.width,
            top: 100 / PAGE_BOX.height,
            width: 50 / PAGE_BOX.width,
            height: 12 / PAGE_BOX.height,
          },
        ],
      },
    ]);
  });

  it('excludes a run with no sourceRunIndex', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        docxPage(0, [
          docxRun({ text: 'Hello', x: 0, sourceRunIndex: undefined }),
        ]),
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
      pages: [docxPage(0, [docxRun({ text, x: 0, w: 73 })])],
      measure,
    });

    const [{ rects: pageRects }] = rects;
    /* Measured: three `i` glyphs are 3px. Interpolated on character count it
     * would be three tenths of the run's 73px box, i.e. 21.9px. */
    expect(pageRects[0].width).toBeCloseTo(3 / PAGE_BOX.width, 6);
    expect(pageRects[0].width).not.toBeCloseTo(21.9 / PAGE_BOX.width, 6);
  });

  it('merges three consecutive runs on one visual line into one rectangle', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 9, text: 'abcdefghi' }),
      pages: [
        docxPage(0, [
          docxRun({ text: 'abc', x: 0, w: 30 }),
          docxRun({ text: 'def', x: 30, w: 30 }),
          docxRun({ text: 'ghi', x: 60, w: 30 }),
        ]),
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      {
        left: 0 / PAGE_BOX.width,
        top: 100 / PAGE_BOX.height,
        width: 90 / PAGE_BOX.width,
        height: 12 / PAGE_BOX.height,
      },
    ]);
  });

  it('keeps a range wrapping across a line break as two rectangles', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 6, text: 'abcdef' }),
      pages: [
        docxPage(0, [
          docxRun({ text: 'abc', x: 0, y: 100, w: 30 }),
          docxRun({ text: 'def', x: 0, y: 120, w: 30 }),
        ]),
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      {
        left: 0 / PAGE_BOX.width,
        top: 100 / PAGE_BOX.height,
        width: 30 / PAGE_BOX.width,
        height: 12 / PAGE_BOX.height,
      },
      {
        left: 0 / PAGE_BOX.width,
        top: 120 / PAGE_BOX.height,
        width: 30 / PAGE_BOX.width,
        height: 12 / PAGE_BOX.height,
      },
    ]);
  });

  it('produces one rectangle group per page when a range spans a page boundary', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 6, text: 'abcdef' }),
      pages: [
        docxPage(3, [docxRun({ text: 'abc', x: 0, w: 30 })]),
        docxPage(4, [docxRun({ text: 'def', x: 0, w: 30 })]),
      ],
      measure,
    });

    expect(rects.map(({ pageIndex }) => pageIndex)).toEqual([3, 4]);
    expect(rects).toHaveLength(2);
    expect(rects[0].rects[0].width).toBeCloseTo(30 / PAGE_BOX.width, 6);
    expect(rects[1].rects[0].width).toBeCloseTo(30 / PAGE_BOX.width, 6);
  });

  it('skips a transformed run while still counting its characters', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ endExclusive: 6, text: 'abcdef' }),
      pages: [
        docxPage(0, [
          docxRun({ text: 'abc', x: 0, w: 30, transform: 'rotate(3deg)' }),
          docxRun({ text: 'def', x: 30, w: 30 }),
        ]),
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      {
        left: 30 / PAGE_BOX.width,
        top: 100 / PAGE_BOX.height,
        width: 30 / PAGE_BOX.width,
        height: 12 / PAGE_BOX.height,
      },
    ]);
  });

  it('prefers highlightBounds over the run box', () => {
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [
        docxPage(0, [
          docxRun({
            text: 'Hello',
            x: 0,
            y: 100,
            highlightBounds: { x: 7, y: 98, width: 55, height: 16 },
          }),
        ]),
      ],
      measure,
    });

    expect(rects[0].rects).toEqual([
      {
        left: 7 / PAGE_BOX.width,
        top: 98 / PAGE_BOX.height,
        width: 55 / PAGE_BOX.width,
        height: 16 / PAGE_BOX.height,
      },
    ]);
  });

  it('draws nothing when the resolved text disagrees with the selector text', () => {
    const rects = resolveDocxRects({
      location: docxLocation({ text: 'Goodbye' }),
      pages: [docxPage(0, [docxRun({ text: 'Hello', x: 0 })])],
      measure,
    });

    expect(rects).toEqual([]);
  });

  it('draws nothing, and does not throw, when endExclusive is past the resolved text', () => {
    expect(() =>
      resolveDocxRects({
        location: docxLocation({ start: 0, endExclusive: 99, text: 'Hello' }),
        pages: [docxPage(0, [docxRun({ text: 'Hello', x: 0 })])],
        measure,
      }),
    ).not.toThrow();

    expect(
      resolveDocxRects({
        location: docxLocation({ start: 0, endExclusive: 99, text: 'Hello' }),
        pages: [docxPage(0, [docxRun({ text: 'Hello', x: 0 })])],
        measure,
      }),
    ).toEqual([]);
  });

  it('expresses geometry as a scale-free fraction of the page box, not raw run coordinates', () => {
    /*
     * This is the representation the fix moved to (design Decision 2), and it
     * replaces the earlier "uses run coordinates as returned, applying no
     * second scale pass" invariant, which pinned the absolute-pixel
     * representation this change removes. It is rewritten rather than
     * deleted so the change in contract is reviewed explicitly, per design
     * Decision 8.
     */
    const rects = resolveDocxRects({
      location: docxLocation(),
      pages: [docxPage(0, [docxRun({ text: 'Hello', x: 240, y: 480 })])],
      measure,
    });

    expect(rects[0].rects).toEqual([
      {
        left: 240 / PAGE_BOX.width,
        top: 480 / PAGE_BOX.height,
        width: 50 / PAGE_BOX.width,
        height: 12 / PAGE_BOX.height,
      },
    ]);
    /* Same box in a different reference width would produce a different
     * pixel rectangle but an identical fraction — see the linearity test
     * below. */
    expect(rects[0].rects[0].left).toBeGreaterThan(0);
    expect(rects[0].rects[0].left).toBeLessThan(1);
  });

  it('produces a fraction agreeing with geometry collected at a different render width within a documented ~1px tolerance', () => {
    /*
     * Bounds design Decision 2's central assumption — that `collectPageRuns`'
     * `width` is a pure linear scale factor — by modelling the vendor's own
     * subpixel font-hinting: coordinates at a second render width are rounded
     * to the nearest tenth of a pixel rather than scaled exactly, the way
     * real glyph metrics snap to device pixels. Tolerance is ~1.2px on the
     * reference page (0.0015 of its 816px width), matching the "roughly a
     * pixel" ceiling the design records before falling back to alternative 5.
     */
    const TOLERANCE_FRACTION = 0.0015;
    const OTHER_WIDTH = 1200;
    const OTHER_HEIGHT = (OTHER_WIDTH / PAGE_BOX.width) * PAGE_BOX.height;
    const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

    const runAtWidth = (width: number, isRounded: boolean) => {
      const scale = width / PAGE_BOX.width;
      const coord = (value: number): number =>
        isRounded ? roundToTenth(value * scale) : value * scale;
      return docxRun({
        text: 'Hello',
        x: coord(0),
        y: coord(100),
        w: coord(50),
        h: coord(12),
      });
    };

    const referenceRect = resolveDocxRects({
      location: docxLocation(),
      pages: [docxPage(0, [runAtWidth(PAGE_BOX.width, false)])],
      measure,
    })[0].rects[0];

    const otherWidthRect = resolveDocxRects({
      location: docxLocation(),
      pages: [
        docxPage(0, [runAtWidth(OTHER_WIDTH, true)], {
          width: OTHER_WIDTH,
          height: OTHER_HEIGHT,
        }),
      ],
      measure,
    })[0].rects[0];

    expect(
      Math.abs(referenceRect.left - otherWidthRect.left),
    ).toBeLessThanOrEqual(TOLERANCE_FRACTION);
    expect(
      Math.abs(referenceRect.top - otherWidthRect.top),
    ).toBeLessThanOrEqual(TOLERANCE_FRACTION);
    expect(
      Math.abs(referenceRect.width - otherWidthRect.width),
    ).toBeLessThanOrEqual(TOLERANCE_FRACTION);
    expect(
      Math.abs(referenceRect.height - otherWidthRect.height),
    ).toBeLessThanOrEqual(TOLERANCE_FRACTION);
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
