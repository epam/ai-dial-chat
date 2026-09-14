import type {
  Annotation,
  AnnotationSelector,
  HtmlTagSelector,
  PdfBBoxSelector,
} from '../models/annotation';
import type { MessageAttachment } from '../models/chat';
import { MIMEType } from '../types/mime-type';
import { inferMimeTypeFromPath } from './mime-type';

/*
 * Wire-format normalization for the annotation model this package owns.
 *
 * It lives here rather than in `@epam/ai-dial-quotations` because
 * `@epam/ai-dial-chat-hooks`' conversation stream has to normalize annotations
 * as chunks arrive, and it is the only thing it needed from that package. With
 * the normalizer there, a host that imported nothing but the conversation
 * hooks still had to install the whole quotations stack — a PDF highlighter, a
 * markdown renderer and an icon set — for one pure function over types
 * declared in this package
 * ([issue #8719](https://github.com/epam/ai-dial-chat/issues/8719)). The
 * rendering side of citations stays in quotations, which imports these.
 */

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

/** Returns whether `value` is shaped like an annotation selector. */
export const isAnnotationSelector = (
  value: unknown,
): value is AnnotationSelector =>
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
export const normalizePersistedHtmlTagAttachmentType = (
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
