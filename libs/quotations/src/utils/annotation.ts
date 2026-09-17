import type {
  Annotation,
  AnnotationSelector,
  DocxRangeSelector,
  ExcelRcRangeSelector,
  Message,
  PptxRangeSelector,
} from '@epam/ai-dial-chat-shared';
import {
  isAnnotationSelector,
  normalizePersistedHtmlTagAttachmentType,
  normalizeRawAnnotations,
} from '@epam/ai-dial-chat-shared';
import type {
  BBox,
  HighlightStyle,
  InputHighlightData,
} from '@epam/pdf-highlighter-kit';
import type { OfficeHighlightLocation } from '../models/office-highlight';
import { normalizeOfficeTableAnchor } from './office-table-anchor';

const CITATION_HIGHLIGHT_STYLE: HighlightStyle = {
  backgroundColor: 'transparent',
  borderColor: 'var(--stroke-accent, #1D4ED8)',
  borderWidth: '2px',
  opacity: 0.5,
  hoverOpacity: 0.5,
};

/**
 * Reads the edges of a `pdf_region` selector's `bbox`, preferring the
 * `lt`/`wh` origin/size pair over the legacy `left`/`top`/`width`/`height`
 * fields when a bbox carries both. Returns `undefined` when neither
 * coordinate form is present with valid numbers.
 */
const readPdfRegionEdges = (
  bbox: unknown,
): { x1: number; y1: number; x2: number; y2: number } | undefined => {
  if (typeof bbox !== 'object' || bbox === null) return undefined;
  const b = bbox as Record<string, unknown>;

  const { lt, wh } = b;
  if (
    Array.isArray(lt) &&
    Array.isArray(wh) &&
    lt.length >= 2 &&
    wh.length >= 2
  ) {
    const [left, top] = lt;
    const [width, height] = wh;
    if (
      typeof left === 'number' &&
      typeof top === 'number' &&
      typeof width === 'number' &&
      typeof height === 'number'
    ) {
      return { x1: left, y1: top, x2: left + width, y2: top + height };
    }
  }

  const { left, top, width, height } = b;
  if (
    typeof left === 'number' &&
    typeof top === 'number' &&
    typeof width === 'number' &&
    typeof height === 'number'
  ) {
    return { x1: left, y1: top, x2: left + width, y2: top + height };
  }

  return undefined;
};

/*
 * Converts one `AnnotationSelector` to the highlighter's `BBox` shape, or
 * `undefined` when the selector is not a recognised PDF selector or fails
 * validation. Recognises three input shapes:
 *  - `pdf_bbox`: `{ page, x1, y1, x2, y2 }` (absolute edges)
 *  - `pdf_region` with `bbox: { lt: [left, top], wh: [width, height] }`
 *  - `pdf_region` with `bbox: { left, top, width, height }` (legacy form)
 * A `pdf_region` bbox converts to edges as `x1 = left`, `y1 = top`,
 * `x2 = left + width`, `y2 = top + height`; `lt`/`wh` wins when a bbox
 * carries both coordinate forms. Both shapes share one validation gate
 * (integer `page >= 1`, four finite coordinates) so that highlight geometry
 * (`annotationsToPdfHighlights`) and page navigation (`getAnnotationPdfPage`)
 * can never disagree about which selectors they understand — both entry
 * points call this one reader.
 */
const readPdfSelectorBox = (selector: AnnotationSelector): BBox | undefined => {
  if (!isAnnotationSelector(selector)) return undefined;
  const s = selector as unknown as Record<string, unknown>;

  let edges: { x1: number; y1: number; x2: number; y2: number } | undefined;
  if (s['type'] === 'pdf_bbox') {
    const { x1, y1, x2, y2 } = s;
    if (
      typeof x1 === 'number' &&
      typeof y1 === 'number' &&
      typeof x2 === 'number' &&
      typeof y2 === 'number'
    ) {
      edges = { x1, y1, x2, y2 };
    }
  } else if (s['type'] === 'pdf_region') {
    edges = readPdfRegionEdges(s['bbox']);
  }

  if (edges == null) return undefined;

  const page = s['page'];
  if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
    return undefined;
  }
  if (![edges.x1, edges.y1, edges.x2, edges.y2].every(Number.isFinite)) {
    return undefined;
  }

  return { page, x1: edges.x1, y1: edges.y1, x2: edges.x2, y2: edges.y2 };
};

/**
 * Maps a list of annotations to `InputHighlightData` entries for the PDF viewer.
 * Recognizes `pdf_bbox` selectors and both `pdf_region` coordinate forms
 * (`lt`/`wh` and legacy `left`/`top`/`width`/`height`); annotations whose
 * `body.selector` contains none of these are skipped. The highlight `id` is
 * `annotation.index` when present, otherwise the position in the input array.
 */
export const annotationsToPdfHighlights = (
  annotations: Annotation[],
): InputHighlightData[] =>
  annotations.flatMap((annotation, i) => {
    const selector = annotation.body?.selector;
    if (selector == null) return [];

    const selectors = Array.isArray(selector) ? selector : [selector];
    const bboxes = selectors.flatMap((s) => {
      if (!isAnnotationSelector(s)) return [];
      const box = readPdfSelectorBox(s);
      return box != null ? [box] : [];
    });

    if (bboxes.length === 0) return [];
    return [
      {
        id: String(annotation.index ?? i),
        bboxes,
        style: CITATION_HIGHLIGHT_STYLE,
      },
    ];
  });

/** Returns a stable string ID for a given annotation, matching the IDs produced by `annotationsToPdfHighlights`. */
export const annotationHighlightId = (
  annotation: Annotation,
  fallbackIndex: number,
): string => String(annotation.index ?? fallbackIndex);

/**
 * Returns the first positive integer PDF page in the annotation's body selectors,
 * or `undefined` when none exists. Recognizes `pdf_bbox` selectors and both
 * `pdf_region` coordinate forms; a page is returned only for a selector whose
 * geometry also validates (see `readPdfSelectorBox`).
 */
export const getAnnotationPdfPage = (
  annotation: Annotation,
): number | undefined => {
  const selector = annotation.body?.selector;
  if (selector == null) return undefined;

  const selectors = Array.isArray(selector) ? selector : [selector];
  for (const s of selectors) {
    if (!isAnnotationSelector(s)) continue;
    const box = readPdfSelectorBox(s);
    if (box != null) return box.page;
  }
  return undefined;
};

/**
 * Resolves the annotation list for a message regardless of how it was loaded.
 *
 * Prefers `custom_content.annotations` (internal format) when present.
 * Falls back to `custom_fields.annotations` (raw API wire format) and
 * normalises those entries using the message's `custom_content.attachments`.
 */
export const resolveMessageAnnotations = (message: Message): Annotation[] => {
  const contentAnnotations = message.custom_content?.annotations;
  if (contentAnnotations?.length) {
    return contentAnnotations
      .filter(
        (a): a is Annotation =>
          a != null && a.body?.source?.attachment?.url != null,
      )
      .map(normalizePersistedHtmlTagAttachmentType);
  }

  const customFields = (message as Record<string, unknown>)['custom_fields'];
  if (typeof customFields !== 'object' || customFields === null) return [];
  const raw = (customFields as Record<string, unknown>)['annotations'];
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return normalizeRawAnnotations(
    raw,
    message.custom_content?.attachments ?? [],
  ).map(normalizePersistedHtmlTagAttachmentType);
};

/**
 * Returns whether `selector` is a `docx_text_range` selector carrying every
 * field the shape requires — a `_range`-suffixed selector missing any field
 * (or with a wrongly-typed one) does not match.
 */
export const isDocxRangeSelector = (
  selector: AnnotationSelector,
): selector is DocxRangeSelector => {
  if (selector.type !== 'docx_text_range') return false;
  const s = selector as Record<string, unknown>;
  return (
    typeof s['story'] === 'string' &&
    Array.isArray(s['path']) &&
    (s['path'] as unknown[]).every((segment) => typeof segment === 'number') &&
    typeof s['start'] === 'number' &&
    typeof s['end'] === 'number' &&
    typeof s['text'] === 'string'
  );
};

/**
 * Returns whether `selector` is a `pptx_text_range` selector carrying every
 * field the shape requires.
 */
export const isPptxRangeSelector = (
  selector: AnnotationSelector,
): selector is PptxRangeSelector => {
  if (selector.type !== 'pptx_text_range') return false;
  const s = selector as Record<string, unknown>;
  return (
    typeof s['slide'] === 'number' &&
    typeof s['shape_id'] === 'string' &&
    typeof s['start'] === 'number' &&
    typeof s['end'] === 'number' &&
    typeof s['text'] === 'string'
  );
};

const isCellAddressLike = (
  value: unknown,
): value is { row: number; col: number } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>)['row'] === 'number' &&
  typeof (value as Record<string, unknown>)['col'] === 'number';

/**
 * Returns whether `selector` is an `excel_rc_range` selector carrying every
 * field the shape requires. `end` may be a cell address, `null`, or absent.
 */
export const isExcelRcRangeSelector = (
  selector: AnnotationSelector,
): selector is ExcelRcRangeSelector => {
  if (selector.type !== 'excel_rc_range') return false;
  const s = selector as Record<string, unknown>;
  return (
    typeof s['sheet'] === 'string' &&
    isCellAddressLike(s['start']) &&
    (s['end'] === undefined || s['end'] === null || isCellAddressLike(s['end']))
  );
};

/**
 * Converts one `docx_text_range` selector to a location, or `undefined` when
 * any field fails validation (non-integer/negative offsets, `end < start`,
 * a non-integer-array `path`, or a non-string `text`). `endExclusive` is the
 * wire's `end` copied through unchanged — already exclusive, not `end + 1`
 * (see `design.md` D3).
 */
const normalizeDocxSelector = (
  selector: DocxRangeSelector,
): OfficeHighlightLocation | undefined => {
  const { story, path, start, end, text } = selector;
  if (
    !path.every((segment) => Number.isInteger(segment)) ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start
  ) {
    return undefined;
  }
  return {
    type: 'docx_text_range',
    story,
    path,
    start,
    endExclusive: end,
    text,
  };
};

/**
 * Converts one `pptx_text_range` selector to a location, or `undefined` when
 * any field fails validation. `endExclusive` is the wire's `end` copied
 * through unchanged (see `design.md` D3).
 */
const normalizePptxSelector = (
  selector: PptxRangeSelector,
): OfficeHighlightLocation | undefined => {
  const { slide, shape_id, start, end, text } = selector;
  if (
    !Number.isInteger(slide) ||
    slide < 1 ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start
  ) {
    return undefined;
  }
  return {
    type: 'pptx_text_range',
    slide,
    shapeId: shape_id,
    start,
    endExclusive: end,
    text,
  };
};

/**
 * Converts one `excel_rc_range` selector to a location, or `undefined` when
 * any field fails validation: non-integer/non-positive `row`/`col`, an empty
 * `sheet`, or an `end` naming a different row or a column before `start`.
 * `end: null` and an omitted `end` are treated identically (both mean a
 * single cell).
 */
const normalizeExcelSelector = (
  selector: ExcelRcRangeSelector,
): OfficeHighlightLocation | undefined => {
  const { sheet, start, end } = selector;
  if (
    sheet.length === 0 ||
    !Number.isInteger(start.row) ||
    !Number.isInteger(start.col) ||
    start.row < 1 ||
    start.col < 1
  ) {
    return undefined;
  }
  if (end == null) return { type: 'excel_rc_range', sheet, start };

  if (
    !Number.isInteger(end.row) ||
    !Number.isInteger(end.col) ||
    end.row !== start.row ||
    end.col < start.col
  ) {
    return undefined;
  }
  return { type: 'excel_rc_range', sheet, start, end };
};

/**
 * Converts an annotation's `body.selector` (scalar or array) to validated
 * `OfficeHighlightLocation` entries, skipping any selector that is not a
 * recognised Office range or temporary table-row anchor, or that fails validation.
 */
export const annotationToOfficeHighlightLocations = (
  annotation: Annotation,
): OfficeHighlightLocation[] => {
  const selector = annotation.body?.selector;
  if (selector == null) return [];
  const selectors = Array.isArray(selector) ? selector : [selector];

  return selectors.flatMap((s): OfficeHighlightLocation[] => {
    if (!isAnnotationSelector(s)) return [];

    if (isDocxRangeSelector(s)) {
      const location = normalizeDocxSelector(s);
      return location ? [location] : [];
    }
    if (isPptxRangeSelector(s)) {
      const location = normalizePptxSelector(s);
      return location ? [location] : [];
    }
    if (isExcelRcRangeSelector(s)) {
      const location = normalizeExcelSelector(s);
      return location ? [location] : [];
    }
    const tableRow = normalizeOfficeTableAnchor(s);
    return tableRow ? [tableRow] : [];
  });
};
