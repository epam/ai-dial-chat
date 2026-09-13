import type {
  Annotation,
  AnnotationSelector,
  DocxRangeSelector,
  ExcelRcRangeSelector,
  HtmlTagSelector,
  Message,
  MessageAttachment,
  PdfBBoxSelector,
  PptxRangeSelector,
} from '@epam/ai-dial-chat-shared';
import { inferMimeTypeFromPath, MIMEType } from '@epam/ai-dial-chat-shared';
import type {
  HighlightStyle,
  InputHighlightData,
} from '@epam/pdf-highlighter-kit';
import type { OfficeHighlightLocation } from '../models/office-highlight';

const CITATION_HIGHLIGHT_STYLE: HighlightStyle = {
  backgroundColor: 'transparent',
  borderColor: 'var(--stroke-accent, #1D4ED8)',
  borderWidth: '2px',
  opacity: 0.5,
  hoverOpacity: 0.5,
};

const OOXML_MIME_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** Infers a citation source MIME type from every extension the canvas can render. */
const inferCitationMimeTypeFromPath = (path: string): string | undefined => {
  const inferredType = inferMimeTypeFromPath(path);
  if (inferredType != null) return inferredType;

  const clean = path.split(/[?#]/)[0];
  const dotIndex = clean.lastIndexOf('.');
  if (dotIndex === -1) return undefined;
  return OOXML_MIME_BY_EXTENSION[clean.slice(dotIndex + 1).toLowerCase()];
};

const isAnnotationSelector = (value: unknown): value is AnnotationSelector =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'type' in value &&
  typeof value.type === 'string';

const normalizeBodySelector = (
  value: unknown,
): AnnotationSelector | AnnotationSelector[] | undefined => {
  if (Array.isArray(value)) return value.filter(isAnnotationSelector);
  return isAnnotationSelector(value) ? value : undefined;
};

/**
 * Maps a list of annotations to `InputHighlightData` entries for the PDF viewer.
 * Annotations whose `body.selector` contains no `pdf_bbox` selectors are skipped.
 * The highlight `id` is `annotation.index` when present, otherwise the position
 * in the input array.
 */
export const annotationsToPdfHighlights = (
  annotations: Annotation[],
): InputHighlightData[] =>
  annotations.flatMap((annotation, i) => {
    const selector = annotation.body?.selector;
    if (selector == null) return [];

    const selectors = Array.isArray(selector) ? selector : [selector];
    const bboxes = selectors.flatMap((s) => {
      if (!isAnnotationSelector(s) || s.type !== 'pdf_bbox') return [];
      const { page, x1, y1, x2, y2 } = s as PdfBBoxSelector;
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        ![x1, y1, x2, y2].every(Number.isFinite)
      )
        return [];
      return [{ page, x1, y1, x2, y2 }];
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
 * or `undefined` when none exists. Independent of bounding-box coordinates.
 */
export const getAnnotationPdfPage = (
  annotation: Annotation,
): number | undefined => {
  const selector = annotation.body?.selector;
  if (selector == null) return undefined;

  const selectors = Array.isArray(selector) ? selector : [selector];
  const bbox = selectors.find(
    (s): s is PdfBBoxSelector =>
      isAnnotationSelector(s) &&
      s.type === 'pdf_bbox' &&
      typeof s.page === 'number' &&
      Number.isInteger(s.page) &&
      s.page >= 1,
  );
  return bbox?.page;
};

const toNumber = (v: unknown): number | null =>
  typeof v === 'number' ? v : null;

const normalizePdfRegionToBbox = (
  selector: unknown,
): PdfBBoxSelector | null => {
  if (typeof selector !== 'object' || selector === null) return null;
  const s = selector as Record<string, unknown>;
  if (s['type'] !== 'pdf_region') return null;
  const bbox = s['bbox'];
  if (typeof bbox !== 'object' || bbox === null) return null;
  const b = bbox as Record<string, unknown>;
  const left = toNumber(b['left']);
  const top = toNumber(b['top']);
  const width = toNumber(b['width']);
  const height = toNumber(b['height']);
  if (left === null || top === null || width === null || height === null)
    return null;
  const page = toNumber(s['page']) ?? 1;
  return {
    type: 'pdf_bbox',
    page,
    x1: left,
    y1: top,
    x2: left + width,
    y2: top + height,
  };
};

const normalizeAttachmentIndexAnnotation = (
  r: Record<string, unknown>,
  attachments: MessageAttachment[],
): Annotation | null => {
  const target = r['target'];
  if (typeof target !== 'object' || target === null) return null;
  const t = target as Record<string, unknown>;

  const source = t['source'];
  if (typeof source !== 'object' || source === null) return null;
  const attachmentIndex = toNumber(
    (source as Record<string, unknown>)['attachment_index'],
  );
  if (attachmentIndex === null) return null;

  const attachment = attachments.find((a) => a.index === attachmentIndex);
  if (attachment?.url == null) return null;

  const selector = normalizePdfRegionToBbox(t['selector']);
  if (selector === null) return null;

  const body = r['body'];
  const bodyObj =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const title =
    typeof bodyObj['title'] === 'string' ? bodyObj['title'] : undefined;
  const quote =
    typeof bodyObj['quote'] === 'string' ? bodyObj['quote'] : undefined;
  const index = toNumber(r['index']) ?? undefined;

  return {
    index,
    body: {
      title,
      quote,
      source: {
        type: 'attachment',
        attachment: {
          type: attachment.type ?? MIMEType.PDF,
          url: attachment.url,
          title: attachment.title,
        },
      },
      selector,
    },
  };
};

const normalizeHtmlTagAnnotation = (
  r: Record<string, unknown>,
): Annotation | null => {
  const target = r['target'];
  if (typeof target !== 'object' || target === null) return null;
  const t = target as Record<string, unknown>;

  const selector = t['selector'];
  if (typeof selector !== 'object' || selector === null) return null;
  const s = selector as Record<string, unknown>;
  if (
    s['type'] !== 'html_tag' ||
    typeof s['tag'] !== 'string' ||
    typeof s['id'] !== 'string'
  ) {
    return null;
  }
  const htmlTagSelector: HtmlTagSelector = {
    type: 'html_tag',
    tag: s['tag'],
    id: s['id'],
  };

  const body = r['body'];
  if (typeof body !== 'object' || body === null) return null;
  const bodyObj = body as Record<string, unknown>;

  const source = bodyObj['source'];
  if (typeof source !== 'object' || source === null) return null;
  const sourceObj = source as Record<string, unknown>;
  if (sourceObj['type'] !== 'attachment') return null;
  const url = sourceObj['url'];
  if (typeof url !== 'string') return null;

  const title =
    typeof bodyObj['title'] === 'string' ? bodyObj['title'] : undefined;
  const quote =
    typeof bodyObj['quote'] === 'string' ? bodyObj['quote'] : undefined;
  const bodySelector = normalizeBodySelector(bodyObj['selector']);

  return {
    index: toNumber(r['index']) ?? undefined,
    target: { selector: htmlTagSelector },
    body: {
      title,
      quote,
      ...(bodySelector !== undefined ? { selector: bodySelector } : {}),
      source: {
        type: 'attachment',
        attachment: {
          type: inferCitationMimeTypeFromPath(url) ?? MIMEType.PDF,
          url,
          title,
        },
      },
    },
  };
};

/**
 * Repairs persisted `html_tag` annotations created by older normalizers that
 * defaulted every non-HTML source to PDF. An explicit, recognized file
 * extension is more reliable than that historical fallback; opaque URLs keep
 * their stored type so genuine PDF citations without an extension still work.
 */
const normalizePersistedHtmlTagAttachmentType = (
  annotation: Annotation,
): Annotation => {
  if (annotation.target?.selector?.type !== 'html_tag') return annotation;

  const attachment = annotation.body?.source?.attachment;
  if (attachment?.url == null) return annotation;

  const inferredType = inferCitationMimeTypeFromPath(attachment.url);
  if (inferredType == null || inferredType === attachment.type) {
    return annotation;
  }

  return {
    ...annotation,
    body: {
      ...annotation.body,
      source: {
        ...annotation.body?.source,
        type: 'attachment',
        attachment: { ...attachment, type: inferredType },
      },
    },
  };
};

/**
 * Normalizes raw annotations from the API wire format (stored in
 * `message.custom_fields.annotations`) to the internal `Annotation` model.
 *
 * Recognizes two wire shapes:
 * - `target.source.attachment_index` (integer) + a `pdf_region` selector
 *   with `{ left, top, width, height }` coordinates, resolved against
 *   `attachments` and converted to `body.source.attachment.url` + a
 *   `pdf_bbox` selector with `{ x1, y1, x2, y2 }` coordinates.
 * - `target.selector` of type `html_tag` (`{ tag, id }`) with a flat
 *   `body.source = { type: 'attachment', url }` — normalized to
 *   `body.source.attachment.url`/`.title` directly, with no attachment-list
 *   lookup, preserving optional indexes and document selectors.
 *
 * Annotations matching neither shape are omitted from the result.
 */
export const normalizeRawAnnotations = (
  rawAnnotations: unknown[],
  attachments: MessageAttachment[],
): Annotation[] =>
  rawAnnotations.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const r = raw as Record<string, unknown>;

    const htmlTagAnnotation = normalizeHtmlTagAnnotation(r);
    if (htmlTagAnnotation) return [htmlTagAnnotation];

    const attachmentIndexAnnotation = normalizeAttachmentIndexAnnotation(
      r,
      attachments,
    );
    if (attachmentIndexAnnotation) return [attachmentIndexAnnotation];

    return [];
  });

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
 * recognised Office range or that fails validation — never throwing.
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
    return [];
  });
};
