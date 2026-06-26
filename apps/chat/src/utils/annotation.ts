import type {
  Annotation,
  Message,
  MessageAttachment,
  PdfBBoxSelector,
} from '@epam/ai-dial-chat-shared';
import { MIMEType } from '@epam/ai-dial-chat-shared';
import type {
  HighlightStyle,
  InputHighlightData,
} from '@epam/pdf-highlighter-kit';

const CITATION_HIGHLIGHT_STYLE: HighlightStyle = {
  backgroundColor: 'transparent',
  borderColor: '#124ACE',
  borderWidth: '2px',
  opacity: 0.5,
  hoverOpacity: 0.5,
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
      if (s.type !== 'pdf_bbox') return [];
      const { page, x1, y1, x2, y2 } = s as PdfBBoxSelector;
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

/**
 * Returns a stable string ID for a given annotation, matching the IDs produced
 * by `annotationsToPdfHighlights`.
 */
export const annotationHighlightId = (
  annotation: Annotation,
  fallbackIndex: number,
): string => String(annotation.index ?? fallbackIndex);

const toNumber = (v: unknown): number | null =>
  typeof v === 'number' ? v : null;

/**
 * Converts a raw `pdf_region` selector (API format: `{ left, top, width, height }`)
 * to a `PdfBBoxSelector` (internal format: `{ x1, y1, x2, y2 }`).
 * Returns `null` for unknown selector types or malformed payloads.
 */
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

/**
 * Normalizes raw annotations from the API wire format (stored in
 * `message.custom_fields.annotations`) to the internal `Annotation` model.
 *
 * The API format uses `target.source.attachment_index` (integer) and a
 * `pdf_region` selector with `{ left, top, width, height }` coordinates.
 * The internal model uses `body.source.attachment.url` (resolved URL) and a
 * `pdf_bbox` selector with `{ x1, y1, x2, y2 }` coordinates.
 *
 * Annotations whose attachment index cannot be resolved or whose selector
 * is not a recognised PDF region are omitted from the result.
 */
export const normalizeRawAnnotations = (
  rawAnnotations: unknown[],
  attachments: MessageAttachment[],
): Annotation[] =>
  rawAnnotations.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const r = raw as Record<string, unknown>;

    const target = r['target'];
    if (typeof target !== 'object' || target === null) return [];
    const t = target as Record<string, unknown>;

    const source = t['source'];
    if (typeof source !== 'object' || source === null) return [];
    const attachmentIndex = toNumber(
      (source as Record<string, unknown>)['attachment_index'],
    );
    if (attachmentIndex === null) return [];

    const attachment = attachments.find((a) => a.index === attachmentIndex);
    if (attachment?.url == null) return [];

    const selector = normalizePdfRegionToBbox(t['selector']);
    if (selector === null) return [];

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

    return [
      {
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
      },
    ];
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
    return contentAnnotations.filter(
      (a): a is Annotation =>
        a != null && a.body?.source?.attachment?.url != null,
    );
  }

  const customFields = (message as Record<string, unknown>)['custom_fields'];
  if (typeof customFields !== 'object' || customFields === null) return [];
  const raw = (customFields as Record<string, unknown>)['annotations'];
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return normalizeRawAnnotations(
    raw,
    message.custom_content?.attachments ?? [],
  );
};
