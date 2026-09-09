import type {
  Annotation,
  AnnotationSelector,
  HtmlTagSelector,
  Message,
  MessageAttachment,
  PdfBBoxSelector,
} from '@epam/ai-dial-chat-shared';
import { inferMimeTypeFromPath, MIMEType } from '@epam/ai-dial-chat-shared';
import type {
  HighlightStyle,
  InputHighlightData,
} from '@epam/pdf-highlighter-kit';

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
