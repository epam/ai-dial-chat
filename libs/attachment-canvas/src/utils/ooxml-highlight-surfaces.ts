import type { DocxDocument, DocxTextRunInfo } from '@silurus/ooxml/docx';
import type { PptxPresentation } from '@silurus/ooxml/pptx';
import type { XlsxViewer } from '@silurus/ooxml/xlsx';
import type {
  OoxmlDocxHighlightLocation,
  OoxmlHighlight,
  OoxmlHighlightLocation,
} from '../models/attachment-canvas';
import { OoxmlHighlightKind } from '../types/attachment-canvas';
import {
  createOoxmlTextMeasurer,
  docxPageSizePx,
  type OoxmlDocxPageRuns,
  type OoxmlHighlightRect,
  pptxSlideSizePx,
  resolveDocxRects,
  resolvePptxRects,
  resolveSurfaceOffset,
  resolveXlsxRects,
  resolveXlsxSheetIndex,
  toXlsxCellRef,
} from './ooxml-highlight-geometry';

/**
 * One rectangle to draw, tagged with the highlight it belongs to. Kept in
 * this dynamically-loaded module (not `OoxmlContent.tsx`) alongside the
 * factories that produce it, so importing the type costs nothing in the
 * eager entry — see the bundle-size budget test in
 * `tests/package-boundary/bundle-budgets.spec.ts`.
 */
export interface TaggedHighlightRect extends OoxmlHighlightRect {
  /** Id of the `OoxmlHighlight` this rectangle came from. */
  highlightId: string;
}

/**
 * Per-format glue between document coordinates and the overlay.
 *
 * Created alongside the viewer so both read the same parse, and discarded with
 * it. `measure` returns rectangles in the overlay's coordinate space, which is
 * the viewer container's own box.
 */
export interface OoxmlHighlightSurface {
  /** Rectangles for every highlight that currently resolves. */
  measure(
    highlights: readonly OoxmlHighlight[],
  ): Promise<TaggedHighlightRect[]>;
  /** Brings one cited location into view, whether or not it resolves to a rectangle. */
  navigate(location: OoxmlHighlightLocation): Promise<void>;
}

/*
 * The scroll viewers mount their own scrolling element and keep the reference
 * private, but they set it up with an inline `overflow:auto`, which is enough to
 * find it. Page offsets are measured against its client box and shifted by its
 * scroll position, so a missing host means no rectangles rather than
 * mispositioned ones.
 */
const findScrollHost = (container: HTMLElement): HTMLElement | null => {
  for (const element of container.querySelectorAll<HTMLElement>('div')) {
    if (element.style.overflow === 'auto') return element;
  }
  return null;
};

/* `getCellViewportRect` returns coordinates inside the grid canvas, which the
 * XLSX viewer places below its own chrome, so rectangles need the canvas's
 * offset within the container added back. */
const getCanvasOffset = (
  container: HTMLElement,
): { left: number; top: number } => {
  const canvas = container.querySelector('canvas');
  if (canvas == null) return { left: 0, top: 0 };

  const canvasBox = canvas.getBoundingClientRect();
  const containerBox = container.getBoundingClientRect();
  return {
    left: canvasBox.left - containerBox.left,
    top: canvasBox.top - containerBox.top,
  };
};

/*
 * Page-scan bound for DOCX.
 *
 * A DOCX selector addresses a story and a source-tree path, never a page, so the
 * page carrying it is found by collecting runs page by page. Source paths run in
 * document order, so once a page's matching-story runs are all past the target
 * path the target cannot appear later and the scan stops — which keeps a
 * highlight on page 3 of a 200-page contract at four collections, and bounds a
 * stale citation to the pages before its path would have been.
 */
const comparePaths = (
  left: readonly number[],
  right: readonly number[],
): number => {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
};

/** Creates the DOCX highlight surface over an already-loaded document. */
export const createDocxHighlightSurface = (
  container: HTMLElement,
  docxDocument: DocxDocument,
  viewer: { getScale(): number; scrollToPage(index: number): void },
  isDisposed: () => boolean,
): OoxmlHighlightSurface => {
  const measureText = createOoxmlTextMeasurer();
  const runsByPage = new Map<number, readonly DocxTextRunInfo[]>();
  const pageOfLocation = new Map<OoxmlHighlightLocation, number>();

  const sizeAt = (index: number) =>
    docxPageSizePx(docxDocument.pageSize(index), viewer.getScale());

  const collectPage = async (
    pageIndex: number,
  ): Promise<readonly DocxTextRunInfo[]> => {
    const cached = runsByPage.get(pageIndex);
    if (cached != null) return cached;

    const runs = await docxDocument.collectPageRuns(pageIndex, {
      width: sizeAt(pageIndex).width,
    });
    if (isDisposed()) return [];
    runsByPage.set(pageIndex, runs);
    return runs;
  };

  /*
   * A DOCX selector addresses a story and a source-tree path, never a page, so
   * the pages carrying it are found by collecting runs page by page. Source
   * paths run in document order, so once a page's same-story runs are all past
   * the target path the range cannot appear later and the scan stops — a
   * highlight on page 3 of a 200-page contract costs four collections, and a
   * stale citation is bounded by where its path would have been.
   */
  const findPages = async (
    location: OoxmlDocxHighlightLocation,
  ): Promise<OoxmlDocxPageRuns[]> => {
    const pages: OoxmlDocxPageRuns[] = [];

    for (
      let pageIndex = 0;
      pageIndex < docxDocument.pageCount;
      pageIndex += 1
    ) {
      const runs = await collectPage(pageIndex);
      if (isDisposed()) return [];

      const storyRuns = runs.filter(
        (run) => run.source != null && run.source.story === location.story,
      );
      const isMatch = (run: DocxTextRunInfo): boolean =>
        run.source != null &&
        comparePaths(run.source.path, location.path) === 0;

      if (storyRuns.some(isMatch)) {
        pages.push({ pageIndex, runs });
        continue;
      }
      const isPastTarget =
        storyRuns.length > 0 &&
        storyRuns.every(
          (run) =>
            run.source != null &&
            comparePaths(run.source.path, location.path) > 0,
        );
      if (pages.length > 0 || isPastTarget) break;
    }

    return pages;
  };

  return {
    measure: async (highlights) => {
      const host = findScrollHost(container);
      if (host == null) return [];

      const rects: TaggedHighlightRect[] = [];
      for (const highlight of highlights) {
        for (const location of highlight.locations) {
          if (location.kind !== OoxmlHighlightKind.DocxTextRange) continue;

          const pages = await findPages(location);
          if (isDisposed()) return [];
          const firstPage = pages.at(0);
          if (firstPage != null) {
            pageOfLocation.set(location, firstPage.pageIndex);
          }

          for (const { pageIndex, rects: pageRects } of resolveDocxRects({
            location,
            pages,
            measure: measureText,
          })) {
            const offset = resolveSurfaceOffset({
              index: pageIndex,
              sizeAt,
              hostClientWidth: host.clientWidth,
            });
            for (const rect of pageRects) {
              rects.push({
                ...rect,
                left: offset.left + rect.left - host.scrollLeft,
                top: offset.top + rect.top - host.scrollTop,
                highlightId: highlight.id,
              });
            }
          }
        }
      }
      return rects;
    },
    navigate: async (location) => {
      if (location.kind !== OoxmlHighlightKind.DocxTextRange) return;

      const known = pageOfLocation.get(location);
      if (known != null) {
        viewer.scrollToPage(known);
        return;
      }
      const pages = await findPages(location);
      if (isDisposed()) return;
      /* Navigation happens even when the range resolves to no rectangle, so the
       * user still lands on the cited page. */
      viewer.scrollToPage(pages.at(0)?.pageIndex ?? 0);
    },
  };
};

/** Creates the PPTX highlight surface over an already-loaded presentation. */
export const createPptxHighlightSurface = (
  container: HTMLElement,
  presentation: PptxPresentation,
  viewer: { getScale(): number; scrollToSlide(index: number): void },
  isDisposed: () => boolean,
): OoxmlHighlightSurface => {
  const measureText = createOoxmlTextMeasurer();

  const sizeAt = () =>
    pptxSlideSizePx(
      presentation.slideWidth,
      presentation.slideHeight,
      viewer.getScale(),
    );

  /* The wire's `slide` is 1-based and the vendor's index is 0-based; this is the
   * only place the two are bridged. */
  const toSlideIndex = (slide: number): number | null =>
    slide < 1 || slide > presentation.slideCount ? null : slide - 1;

  return {
    measure: async (highlights) => {
      const host = findScrollHost(container);
      if (host == null) return [];

      const rects: TaggedHighlightRect[] = [];
      for (const highlight of highlights) {
        for (const location of highlight.locations) {
          if (location.kind !== OoxmlHighlightKind.PptxTextRange) continue;

          const slideIndex = toSlideIndex(location.slide);
          if (slideIndex == null) continue;

          const runs = await presentation.collectSlideRuns(
            slideIndex,
            sizeAt().width,
          );
          if (isDisposed()) return [];

          const offset = resolveSurfaceOffset({
            index: slideIndex,
            sizeAt,
            hostClientWidth: host.clientWidth,
          });
          for (const rect of resolvePptxRects({
            location,
            runs,
            measure: measureText,
          })) {
            rects.push({
              ...rect,
              left: offset.left + rect.left - host.scrollLeft,
              top: offset.top + rect.top - host.scrollTop,
              highlightId: highlight.id,
            });
          }
        }
      }
      return rects;
    },
    navigate: async (location) => {
      if (location.kind !== OoxmlHighlightKind.PptxTextRange) return;
      const slideIndex = toSlideIndex(location.slide);
      if (slideIndex == null) return;
      viewer.scrollToSlide(slideIndex);
    },
  };
};

/** Creates the XLSX highlight surface over the self-loading viewer. */
export const createXlsxHighlightSurface = (
  container: HTMLElement,
  viewer: XlsxViewer,
  isDisposed: () => boolean,
): OoxmlHighlightSurface => ({
  measure: async (highlights) => {
    const offset = getCanvasOffset(container);
    const viewportWidth = container.clientWidth - offset.left;
    const rects: TaggedHighlightRect[] = [];

    for (const highlight of highlights) {
      for (const location of highlight.locations) {
        if (location.kind !== OoxmlHighlightKind.XlsxCellRange) continue;
        const sheetIndex = resolveXlsxSheetIndex(
          location.sheet,
          viewer.sheetNames,
        );
        /* Only the active sheet has viewport geometry; a highlight on another
         * sheet simply has no rectangle until the user switches to it. */
        if (sheetIndex == null || sheetIndex !== viewer.sheetIndex) continue;

        for (const rect of resolveXlsxRects({
          location,
          getCellViewportRect: (cell) => {
            const cellRect = viewer.getCellViewportRect(cell);
            if (cellRect == null) return null;
            return {
              left: cellRect.x,
              top: cellRect.y,
              width: cellRect.width,
              height: cellRect.height,
            };
          },
          viewportWidth,
        })) {
          rects.push({
            ...rect,
            left: offset.left + rect.left,
            top: offset.top + rect.top,
            highlightId: highlight.id,
          });
        }
      }
    }
    return rects;
  },
  navigate: async (location) => {
    if (location.kind !== OoxmlHighlightKind.XlsxCellRange) return;
    const sheetIndex = resolveXlsxSheetIndex(location.sheet, viewer.sheetNames);
    if (sheetIndex == null) return;

    if (sheetIndex !== viewer.sheetIndex) {
      await viewer.goToSheet(sheetIndex);
      if (isDisposed()) return;
    }
    await viewer.scrollToCell(toXlsxCellRef(location.start), {
      align: 'center',
    });
  },
});
