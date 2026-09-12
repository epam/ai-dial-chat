import type { DocxTextRunInfo } from '@silurus/ooxml/docx';
import type { PptxTextRunInfo } from '@silurus/ooxml/pptx';
import type {
  OoxmlCellAddress,
  OoxmlDocxHighlightLocation,
  OoxmlPptxHighlightLocation,
  OoxmlXlsxHighlightLocation,
} from '../models/attachment-canvas';

/** A resolved highlight rectangle, in the coordinate space of the surface it is drawn over. */
export interface OoxmlHighlightRect {
  /** Distance from the surface's physical left edge, in CSS pixels. */
  left: number;
  /** Distance from the surface's physical top edge, in CSS pixels. */
  top: number;
  /** Width in CSS pixels. */
  width: number;
  /** Height in CSS pixels. */
  height: number;
  /**
   * Whether the rectangle was cut short by the viewport rather than by the end
   * of the cited range, so the renderer can leave that edge open instead of
   * implying the range stops there.
   */
  isClippedAtEnd?: boolean;
}

/** Width of `text` rendered in the CSS shorthand `font`, in CSS pixels. */
export type OoxmlTextMeasurer = (font: string, text: string) => number;

/** Size of one page or slide, in CSS pixels at the current scale. */
export interface OoxmlSurfaceSize {
  /** Width in CSS pixels. */
  width: number;
  /** Height in CSS pixels. */
  height: number;
}

/** Offset of one page or slide within its scroll host's content box, in CSS pixels. */
export interface OoxmlSurfaceOffset {
  /** Distance from the content box's physical left edge. */
  left: number;
  /** Distance from the content box's physical top edge. */
  top: number;
}

/** The scroll-layout options this renderer passes to a `@silurus/ooxml` scroll viewer. */
export interface OoxmlScrollLayout {
  /** Vertical space between pages/slides. Defaults to `OOXML_SCROLL_GAP_DEFAULT`. */
  gap?: number;
  /** Space above the first page/slide. Defaults to `gap`. */
  paddingTop?: number;
  /** Minimum space left of a page/slide. Defaults to `gap`. */
  paddingLeft?: number;
}

/** Inputs `resolveSurfaceOffset` needs to place one page or slide. */
export interface OoxmlSurfaceOffsetOptions {
  /** 0-based page or slide index. */
  index: number;
  /** Size, in CSS pixels at the current scale, of the page/slide at an index. */
  sizeAt: (index: number) => OoxmlSurfaceSize;
  /** `clientWidth` of the scroll host — the reference the vendor centres against. */
  hostClientWidth: number;
  /** Scroll-layout options passed to the viewer. */
  layout?: OoxmlScrollLayout;
}

/** Runs one page contributed, as `DocxDocument.collectPageRuns` returned them. */
export interface OoxmlDocxPageRuns {
  /** 0-based page index the runs came from. */
  pageIndex: number;
  /** The page's runs, in layout order. */
  runs: readonly DocxTextRunInfo[];
}

/** Rectangles resolved on one page, in that page's own CSS pixel space. */
export interface OoxmlDocxPageRects {
  /** 0-based page index the rectangles belong to. */
  pageIndex: number;
  /** Rectangles covering the part of the range that falls on this page. */
  rects: OoxmlHighlightRect[];
}

/** Inputs `resolveDocxRects` needs to place one DOCX range. */
export interface OoxmlDocxResolveOptions {
  /** The cited range, with offsets already exclusive at the upper bound. */
  location: OoxmlDocxHighlightLocation;
  /**
   * Consecutive pages' runs, in page order. A range may span a page boundary,
   * so the story's text is accumulated across every page supplied and the
   * result is grouped back per page.
   */
  pages: readonly OoxmlDocxPageRuns[];
  /** Text measurer used for partially covered runs. Without one, partial runs yield no rectangle. */
  measure?: OoxmlTextMeasurer;
}

/** Inputs `resolvePptxRects` needs to place one PPTX range on one slide. */
export interface OoxmlPptxResolveOptions {
  /** The cited range, with offsets already exclusive at the upper bound. */
  location: OoxmlPptxHighlightLocation;
  /** Runs `PptxPresentation.collectSlideRuns` returned for the slide, in layout order. */
  runs: readonly PptxTextRunInfo[];
  /** Text measurer used for partially covered runs. Without one, partial runs yield no rectangle. */
  measure?: OoxmlTextMeasurer;
}

/** Inputs `resolveXlsxRects` needs to place one XLSX cell range. */
export interface OoxmlXlsxResolveOptions {
  /** The cited cell or same-row cell range. */
  location: OoxmlXlsxHighlightLocation;
  /** The viewer's own `getCellViewportRect`, which returns `null` for a cell it cannot measure. */
  getCellViewportRect: (cell: OoxmlCellAddress) => OoxmlHighlightRect | null;
  /** Width of the grid viewport, used to clip a range wider than the screen. */
  viewportWidth?: number;
}

/**
 * Points → CSS pixels (96/72).
 *
 * Read out of `@silurus/ooxml@0.86.1`'s `DocxScrollViewer._pageWidthPx`, which
 * is `pageSize(i).widthPt * 4 / 3 * scale`. Not part of the vendor's public
 * type surface — see the version-coupling note on `resolveSurfaceOffset`.
 */
const PT_TO_CSS_PX = 4 / 3;

/**
 * EMU per CSS pixel.
 *
 * Read out of `PptxScrollViewer._slideWidthPx`, which is
 * `presentation.slideWidth / 9525 * scale`.
 */
const EMU_PER_CSS_PX = 9525;

/** Vertical tolerance, in CSS pixels, within which two rectangles count as being on one visual line. */
const SAME_LINE_TOLERANCE_PX = 2;

/** Horizontal tolerance, in CSS pixels, within which two same-line rectangles count as adjacent. */
const ADJACENT_TOLERANCE_PX = 1;

/** Group key used by resolvers whose range cannot span more than one surface. */
const SINGLE_SURFACE_INDEX = 0;

/** `@silurus/ooxml`'s default `gap`, and its default for every padding option. */
export const OOXML_SCROLL_GAP_DEFAULT = 16;

/** Creates a canvas-backed text measurer, or `undefined` when no 2D context is available. */
export const createOoxmlTextMeasurer = (): OoxmlTextMeasurer | undefined => {
  const context = document.createElement('canvas').getContext('2d');
  if (context == null) return undefined;

  return (font, text) => {
    if (context.font !== font) context.font = font;
    return context.measureText(text).width;
  };
};

/** Size in CSS pixels of a DOCX page whose `pageSize` is given in points. */
export const docxPageSizePx = (
  pageSizePt: { widthPt: number; heightPt: number },
  scale: number,
): OoxmlSurfaceSize => ({
  width: pageSizePt.widthPt * PT_TO_CSS_PX * scale,
  height: pageSizePt.heightPt * PT_TO_CSS_PX * scale,
});

/** Size in CSS pixels of a PPTX slide whose dimensions are given in EMU. */
export const pptxSlideSizePx = (
  slideWidthEmu: number,
  slideHeightEmu: number,
  scale: number,
): OoxmlSurfaceSize => ({
  width: (slideWidthEmu / EMU_PER_CSS_PX) * scale,
  height: (slideHeightEmu / EMU_PER_CSS_PX) * scale,
});

/**
 * Offset of one page or slide inside its scroll host's content box.
 *
 * This is the only place the page-stacking relationship is encoded. Every input
 * is published by the vendor — page/slide size, the current scale, and the
 * `gap`/padding this renderer itself passes in — but the stacking arithmetic is
 * derived from the installed build rather than guaranteed by a public type, so
 * a `@silurus/ooxml` upgrade can change it with no TypeScript signal. Keeping it
 * here means such an upgrade breaks one function and one test.
 */
export const resolveSurfaceOffset = ({
  index,
  sizeAt,
  hostClientWidth,
  layout,
}: OoxmlSurfaceOffsetOptions): OoxmlSurfaceOffset => {
  const gap = layout?.gap ?? OOXML_SCROLL_GAP_DEFAULT;
  const paddingTop = layout?.paddingTop ?? gap;
  const paddingLeft = layout?.paddingLeft ?? gap;

  let top = paddingTop + index * gap;
  for (let page = 0; page < index; page += 1) {
    top += sizeAt(page).height;
  }

  const { width } = sizeAt(index);
  const left = Math.max(paddingLeft, (hostClientWidth - width) / 2);

  return { left, top };
};

/**
 * Merges rectangles that sit on one visual line and touch or overlap.
 *
 * A cited sentence usually spans several runs; without this it renders as a row
 * of separate boxes instead of one band.
 */
export const mergeSameLineRects = (
  rects: readonly OoxmlHighlightRect[],
): OoxmlHighlightRect[] => {
  const sorted = [...rects].sort(
    (first, second) => first.top - second.top || first.left - second.left,
  );

  const merged: OoxmlHighlightRect[] = [];
  for (const rect of sorted) {
    const previous = merged.at(-1);
    const isSameLine =
      previous != null &&
      Math.abs(previous.top - rect.top) <= SAME_LINE_TOLERANCE_PX &&
      Math.abs(previous.height - rect.height) <= SAME_LINE_TOLERANCE_PX;
    const isAdjacent =
      previous != null &&
      rect.left <= previous.left + previous.width + ADJACENT_TOLERANCE_PX;

    if (isSameLine && isAdjacent) {
      const right = Math.max(
        previous.left + previous.width,
        rect.left + rect.width,
      );
      previous.width = right - previous.left;
      previous.height = Math.max(previous.height, rect.height);
      continue;
    }

    merged.push({ ...rect });
  }

  return merged;
};

/** Bounding box of one text run, in its page's or slide's own CSS pixel space. */
interface RunBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One matched run and the character span it occupies within the resolved text. */
interface RunSpan<TRun> {
  run: TRun;
  box: RunBox;
  start: number;
  end: number;
  /** Index of the surface (page or slide) the run was collected from. */
  surfaceIndex: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isSameNumberPath = (
  runPath: readonly number[],
  locationPath: readonly number[],
): boolean =>
  runPath.length === locationPath.length &&
  runPath.every((segment, position) => segment === locationPath[position]);

/*
 * Mirrors `@silurus/ooxml`'s own vertical-text normalisation: only a run marked
 * `eastAsianVert` whose measured text is wider than its box gets rescaled.
 */
const eastAsianVertScale = (
  isEastAsianVert: boolean,
  boxWidth: number,
  measureRun: () => number,
): number => {
  if (!isEastAsianVert) return 1;
  const measured = measureRun();
  if (!(measured > 0) || boxWidth >= measured) return 1;
  return boxWidth / measured;
};

/**
 * Rectangle covering `[sliceStart, sliceEnd)` of one run's text.
 *
 * A fully covered run uses its own reported box, so it needs no measurement at
 * all. A partially covered run is measured in the run's own font — proportional
 * fonts make character-count interpolation visibly wrong — and yields no
 * rectangle when no measurer is available, because a guessed width would put
 * the highlight over the wrong characters.
 */
const resolveRunRect = (
  text: string,
  box: RunBox,
  font: string,
  letterSpacingPx: number,
  isEastAsianVert: boolean,
  sliceStart: number,
  sliceEnd: number,
  measure?: OoxmlTextMeasurer,
): OoxmlHighlightRect | null => {
  if (sliceEnd <= sliceStart) return null;

  if (sliceStart <= 0 && sliceEnd >= text.length) {
    return { left: box.x, top: box.y, width: box.width, height: box.height };
  }

  if (measure == null) return null;

  const measureText = (value: string): number => measure(font, value);
  const startOffset =
    sliceStart <= 0 ? 0 : measureText(text.slice(0, sliceStart));
  const endOffset =
    sliceEnd >= text.length
      ? measureText(text)
      : measureText(text.slice(0, sliceEnd));

  const charsBefore = [...text.slice(0, sliceStart)].length;
  const charsCovered = [...text.slice(sliceStart, sliceEnd)].length;
  const scale = eastAsianVertScale(isEastAsianVert, box.width, () =>
    measureText(text),
  );

  const left = (startOffset + charsBefore * letterSpacingPx) * scale;
  const width =
    (Math.max(0, endOffset - startOffset) +
      Math.max(0, charsCovered - 1) * letterSpacingPx) *
    scale;

  if (width <= 0) return null;

  return { left: box.x + left, top: box.y, width, height: box.height };
};

/*
 * Walks the matched runs once: accumulates their text so the location's offsets
 * can be validated against it, then turns the covered part of each run into a
 * rectangle, grouped by the page or slide the run came from. A `transform` on a
 * run means its axis-aligned box no longer describes where the glyphs are, so
 * such a run contributes no rectangle — while still contributing its characters,
 * because it is source text the offsets address.
 */
const resolveRangeRects = <TRun>(
  spans: readonly RunSpan<TRun>[],
  resolvedText: string,
  start: number,
  endExclusive: number,
  expectedText: string,
  isTransformed: (run: TRun) => boolean,
  toRect: (
    span: RunSpan<TRun>,
    sliceStart: number,
    sliceEnd: number,
  ) => OoxmlHighlightRect | null,
): Map<number, OoxmlHighlightRect[]> => {
  const grouped = new Map<number, OoxmlHighlightRect[]>();

  if (!Number.isInteger(start) || !Number.isInteger(endExclusive))
    return grouped;
  if (start < 0 || endExclusive <= start) return grouped;
  if (endExclusive > resolvedText.length) return grouped;
  if (resolvedText.slice(start, endExclusive) !== expectedText) return grouped;

  for (const span of spans) {
    if (span.end <= start || span.start >= endExclusive) continue;
    if (isTransformed(span.run)) continue;

    const sliceStart = clamp(start - span.start, 0, span.end - span.start);
    const sliceEnd = clamp(
      endExclusive - span.start,
      sliceStart,
      span.end - span.start,
    );
    const rect = toRect(span, sliceStart, sliceEnd);
    if (rect == null) continue;

    const existing = grouped.get(span.surfaceIndex);
    if (existing == null) {
      grouped.set(span.surfaceIndex, [rect]);
      continue;
    }
    existing.push(rect);
  }

  for (const [surfaceIndex, rects] of grouped) {
    grouped.set(surfaceIndex, mergeSameLineRects(rects));
  }

  return grouped;
};

/**
 * Rectangles covering one DOCX range, grouped per page.
 *
 * Returns an empty array whenever the range cannot be resolved with confidence —
 * no matching run, a resolved text that disagrees with the selector's own
 * `text`, or an offset past the end of the resolved text.
 */
export const resolveDocxRects = ({
  location,
  pages,
  measure,
}: OoxmlDocxResolveOptions): OoxmlDocxPageRects[] => {
  const spans: RunSpan<DocxTextRunInfo>[] = [];
  let resolvedText = '';

  for (const { pageIndex, runs } of pages) {
    for (const run of runs) {
      /* A run with no `source` or no `sourceRunIndex` is synthesized — a page
       * number, a field result, a list bullet — so it is neither highlightable
       * nor part of the source text the selector's offsets address. */
      if (run.source == null || run.sourceRunIndex == null) continue;
      if (run.source.story !== location.story) continue;
      if (!isSameNumberPath(run.source.path, location.path)) continue;

      const bounds = run.highlightBounds;
      const box: RunBox =
        bounds == null
          ? { x: run.x, y: run.y, width: run.w, height: run.h }
          : {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            };

      spans.push({
        run,
        box,
        start: resolvedText.length,
        end: resolvedText.length + run.text.length,
        surfaceIndex: pageIndex,
      });
      resolvedText += run.text;
    }
  }

  const grouped = resolveRangeRects(
    spans,
    resolvedText,
    location.start,
    location.endExclusive,
    location.text,
    (run) => run.transform != null,
    ({ run, box }, sliceStart, sliceEnd) =>
      resolveRunRect(
        run.text,
        box,
        run.font,
        run.letterSpacingPx ?? 0,
        run.eastAsianVert === true,
        sliceStart,
        sliceEnd,
        measure,
      ),
  );

  return [...grouped]
    .sort(([first], [second]) => first - second)
    .map(([pageIndex, rects]) => ({ pageIndex, rects }));
};

/*
 * A rotated or flipped shape's text is not axis-aligned, so an axis-aligned
 * rectangle over it would sit somewhere the cited words are not. Composing the
 * rotation is a declared non-goal; no highlight is the correct outcome.
 */
const isTransformedShape = (run: PptxTextRunInfo): boolean =>
  run.rotation !== 0 ||
  (run.textBodyRotation ?? 0) !== 0 ||
  run.shapeFlipH === true ||
  run.shapeFlipV === true;

/**
 * Rectangles covering one PPTX range on one slide, in that slide's CSS pixel space.
 *
 * Returns an empty array when no run matches the shape, when the resolved text
 * disagrees with the selector's `text`, or when the matched shape is rotated or
 * flipped.
 */
export const resolvePptxRects = ({
  location,
  runs,
  measure,
}: OoxmlPptxResolveOptions): OoxmlHighlightRect[] => {
  const spans: RunSpan<PptxTextRunInfo>[] = [];
  let resolvedText = '';

  for (const run of runs) {
    if (run.shapeId == null) continue;
    if (String(run.shapeId) !== location.shapeId) continue;
    /* `origin` names where the element came from; master and layout text is
     * template chrome rather than the slide's own cited content. */
    if (run.origin === 'master' || run.origin === 'layout') continue;

    spans.push({
      run,
      box: {
        x: run.shapeX + run.inShapeX,
        y: run.shapeY + run.inShapeY,
        width: run.w,
        height: run.h,
      },
      start: resolvedText.length,
      end: resolvedText.length + run.text.length,
      surfaceIndex: SINGLE_SURFACE_INDEX,
    });
    resolvedText += run.text;
  }

  const grouped = resolveRangeRects(
    spans,
    resolvedText,
    location.start,
    location.endExclusive,
    location.text,
    isTransformedShape,
    ({ run, box }, sliceStart, sliceEnd) =>
      resolveRunRect(
        run.text,
        box,
        run.font,
        0,
        false,
        sliceStart,
        sliceEnd,
        measure,
      ),
  );

  return grouped.get(SINGLE_SURFACE_INDEX) ?? [];
};

/** 0-based index of the sheet a location names, or `null` when the workbook has no such sheet. */
export const resolveXlsxSheetIndex = (
  sheet: string,
  sheetNames: readonly string[],
): number | null => {
  /* Exact match only. A case-insensitive or trimmed fallback could resolve to a
   * different sheet than the citation meant, and two sheets may differ only in
   * case. */
  const index = sheetNames.indexOf(sheet);
  return index === -1 ? null : index;
};

/** A1-style reference for a 1-based cell address, for the viewer's string-keyed `scrollToCell`. */
export const toXlsxCellRef = ({ row, col }: OoxmlCellAddress): string => {
  let column = '';
  let remaining = col;
  while (remaining > 0) {
    const rest = (remaining - 1) % 26;
    column = String.fromCharCode(65 + rest) + column;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return `${column}${row}`;
};

/**
 * Rectangles covering one XLSX cell or same-row range, in the grid's viewport space.
 *
 * A cell the viewer reports as unmeasurable contributes nothing rather than a
 * zero rectangle, which would draw a visible artefact at the grid origin.
 */
export const resolveXlsxRects = ({
  location,
  getCellViewportRect,
  viewportWidth,
}: OoxmlXlsxResolveOptions): OoxmlHighlightRect[] => {
  const { start, end } = location;
  const lastCol = end == null ? start.col : end.col;
  if (end != null && (end.row !== start.row || end.col < start.col)) return [];

  const rects: OoxmlHighlightRect[] = [];
  for (let col = start.col; col <= lastCol; col += 1) {
    const rect = getCellViewportRect({ row: start.row, col });
    if (rect != null) rects.push(rect);
  }
  if (rects.length === 0) return [];

  const merged = mergeSameLineRects(rects);
  if (viewportWidth == null || merged.length !== 1) return merged;

  /* A range wider than the grid viewport stays anchored at its starting cell —
   * the cited cell is the one that must remain visible — and is clipped rather
   * than re-centred on the range's midpoint. */
  const [rect] = merged;
  const visibleWidth = Math.min(rect.width, viewportWidth - rect.left);
  if (visibleWidth >= rect.width) return merged;

  return [{ ...rect, width: Math.max(0, visibleWidth), isClippedAtEnd: true }];
};
