import { AttachmentDto as Attachment } from '../dto/attachment.dto';
import { AnnotationDto as Annotation } from '../dto/annotation.dto';
import { ConversationMessageDto } from '../dto/conversation-message.dto';
import {
  StageAttachmentDto as StageAttachment,
  StageDto as Stage,
} from '../dto/stage.dto';

/** Minimal types matching the DIAL Core SSE delta payload. */

interface SseDelta {
  content?: string;
  responseId?: string;
  custom_content?: {
    form_schema?: unknown;
    attachments?: Attachment[];
    stages?: Stage[];
    annotations?: Annotation[];
    state?: Record<string, unknown>;
  };
  custom_fields?: {
    annotations?: unknown[];
  };
}

interface SseChoice {
  delta?: SseDelta;
}

interface SseChunk {
  id?: string;
  choices?: SseChoice[];
}

/** DIAL Core's in-band mid-stream error chunk shape: `{ error: {...} }` instead of `{ choices: [...] }`. */
export interface DialStreamErrorPayload {
  message: string;
  type?: string;
  code?: string;
  displayMessage?: string;
}

interface RawDialStreamError {
  message?: string;
  type?: string;
  code?: string;
  display_message?: string;
}

/**
 * Detects DIAL Core's mid-stream error chunk (no `choices`, just an `error`
 * object) — e.g. emitted when a QuickApp's downstream tool call can't reach
 * its upstream server. Returns `null` for a normal delta chunk.
 */
export const extractDialStreamError = (
  rawChunk: unknown,
): DialStreamErrorPayload | null => {
  const error = (rawChunk as { error?: RawDialStreamError })?.error;
  if (!error || typeof error.message !== 'string') return null;
  return {
    message: error.message,
    type: error.type,
    code: error.code,
    displayMessage: error.display_message,
  };
};

const mergeStageAttachments = (
  existing: StageAttachment[],
  incoming: StageAttachment[],
): StageAttachment[] => {
  const result = [...existing];
  for (const att of incoming) {
    const idx =
      att.index != null ? result.findIndex((a) => a.index === att.index) : -1;
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        ...att,
        title: (result[idx].title ?? '') + (att.title ?? ''),
        data:
          att.data != null
            ? (result[idx].data ?? '') + att.data
            : result[idx].data,
      };
    } else {
      result.push(att);
    }
  }
  return result;
};

const mergeOptionalText = (
  existing: string | undefined,
  incoming: string | undefined,
): string | undefined =>
  existing !== undefined || incoming !== undefined
    ? (existing ?? '') + (incoming ?? '')
    : undefined;

const mergeStages = (existing: Stage[], incoming: Stage[]): Stage[] => {
  const result = [...existing];
  for (const stage of incoming) {
    const idx = result.findIndex((s) => s.index === stage.index);
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        ...stage,
        name: (result[idx].name ?? '') + (stage.name ?? ''),
        content: mergeOptionalText(result[idx].content, stage.content),
        attachments: stage.attachments?.length
          ? mergeStageAttachments(
              result[idx].attachments ?? [],
              stage.attachments,
            )
          : result[idx].attachments,
      };
    } else {
      /*
       * A brand-new stage's first chunk can carry `name: null` (DIAL Core's
       * "stage opened, name pending" signal, before the name text streams
       * in) — normalize it the same way the merge branch above already
       * coalesces `null` to `''`, so a persisted stage never carries a
       * `null` name if the frontend renders it directly after reload.
       */
      result.push({ ...stage, name: stage.name ?? '' });
    }
  }
  return result;
};

const toNumber = (v: unknown): number | null =>
  typeof v === 'number' ? v : null;

const normalizeAttachmentIndexAnnotation = (
  r: Record<string, unknown>,
  attachments: Attachment[],
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

  const selector = t['selector'];
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
  if (left === null || top === null || width === null || height === null) {
    return null;
  }
  const page = toNumber(s['page']) ?? 1;

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
          type: attachment.type,
          url: attachment.url,
          title: attachment.title,
        },
      },
    },
    target: {
      selector: { type: 'pdf_bbox', page, x1: left, y1: top, x2: left + width, y2: top + height },
    },
  };
};

/**
 * Infers the attachment MIME type from its URL extension for the `html_tag`
 * wire shape, which carries no `attachment_index`/`type` to resolve against.
 * Mirrors the extension set `inferMimeTypeFromPath` in
 * `libs/chat-shared/src/utils/mime-type.ts` covers that matters for
 * `CitationCard`'s Preview/"Open in browser" vs "Download" label choice
 * (only HTML/XHTML change that choice); duplicated locally rather than
 * importing `chat-shared` into the backend for one narrow lookup.
 */
const inferAttachmentTypeFromUrl = (url: string): string => {
  const clean = url.split(/[?#]/)[0];
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'html' || ext === 'htm') return 'text/html';
  if (ext === 'xhtml') return 'application/xhtml+xml';
  return 'application/pdf';
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

  return {
    target: { selector: { type: 'html_tag', tag: s['tag'], id: s['id'] } },
    body: {
      title,
      quote,
      source: {
        type: 'attachment',
        attachment: { type: inferAttachmentTypeFromUrl(url), url, title },
      },
    },
  };
};

/**
 * Normalizes raw wire-format annotations (from `delta.custom_fields.annotations`)
 * into the persisted `AnnotationDto` shape, mirroring `normalizeRawAnnotations`
 * in `libs/quotations/src/utils/annotation.ts` — kept as a separate,
 * server-local implementation (no cross-import) since `libs/quotations` is a
 * React/UI lib with no place in the NestJS backend's dependency graph.
 *
 * Recognizes both the legacy `attachment_index` + `pdf_region` wire shape and
 * the `html_tag` + flat `body.source.url` wire shape. Entries matching
 * neither are omitted.
 */
export const normalizeRawAnnotationsServer = (
  raw: unknown[],
  attachments: Attachment[],
): Annotation[] =>
  raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const r = entry as Record<string, unknown>;

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
 * Two annotations are the same when both carry the same `index`, or — for
 * `html_tag`-selector annotations, which never carry an `index` — when both
 * have the same `target.selector.id`. Two annotations that both lack an
 * `index` and are not matching `html_tag` ids are never considered the
 * same, so distinct `html_tag` citations don't collapse into one entry.
 */
const sameAnnotation = (a: Annotation, b: Annotation): boolean => {
  if (a.index != null && b.index != null) return a.index === b.index;
  const aId =
    a.target?.selector?.type === 'html_tag' ? a.target.selector.id : undefined;
  const bId =
    b.target?.selector?.type === 'html_tag' ? b.target.selector.id : undefined;
  return aId != null && aId === bId;
};

const mergeAnnotations = (
  existing: Annotation[],
  incoming: Annotation[],
): Annotation[] => {
  const result = [...existing];
  for (const annotation of incoming) {
    const idx = result.findIndex((a) => sameAnnotation(a, annotation));
    if (idx >= 0) {
      const prev = result[idx];
      result[idx] = {
        ...prev,
        ...annotation,
        body: {
          ...prev.body,
          ...annotation.body,
          title:
            (prev.body?.title ?? '') + (annotation.body?.title ?? '') ||
            undefined,
          quote:
            (prev.body?.quote ?? '') + (annotation.body?.quote ?? '') ||
            undefined,
        },
      };
    } else {
      result.push(annotation);
    }
  }
  return result;
};

/**
 * Applies a single parsed DIAL Core SSE chunk to an assistant message,
 * accumulating text content, attachments, stages, annotations, form_schema,
 * and responseId. `state` is overwritten rather than accumulated, matching
 * the DIAL stateful-app contract (only the latest value is meaningful).
 * Pure function — returns a new message object.
 */
export const applyChunkToMessage = (
  message: ConversationMessageDto,
  rawChunk: unknown,
): ConversationMessageDto => {
  const chunk = rawChunk as SseChunk;
  const delta = chunk.choices?.[0]?.delta;
  if (!delta) return message;

  const content = delta.content ?? '';
  const formSchema = delta.custom_content?.form_schema;
  const attachments = delta.custom_content?.attachments;
  const stages = delta.custom_content?.stages;
  const annotations = delta.custom_content?.annotations;
  const rawAnnotations = delta.custom_fields?.annotations;
  const state = delta.custom_content?.state;

  const hasContentUpdate =
    !!content ||
    !!formSchema ||
    !!attachments?.length ||
    !!stages?.length ||
    !!annotations?.length ||
    !!rawAnnotations?.length ||
    !!state;

  const responseId =
    delta.responseId ?? (hasContentUpdate ? chunk.id : undefined);

  if (!hasContentUpdate && !responseId) return message;

  const existing = message.custom_content ?? {};
  const allAttachments = [...(existing.attachments ?? []), ...(attachments ?? [])];
  const normalizedRawAnnotations = rawAnnotations?.length
    ? normalizeRawAnnotationsServer(rawAnnotations, allAttachments)
    : [];
  const incomingAnnotations = [
    ...(annotations ?? []),
    ...normalizedRawAnnotations,
  ];
  const hasCustomUpdate =
    !!formSchema ||
    !!attachments?.length ||
    !!stages?.length ||
    !!incomingAnnotations.length ||
    !!state;

  return {
    ...message,
    content: content ? message.content + content : message.content,
    ...(responseId && { responseId }),
    ...(hasCustomUpdate && {
      custom_content: {
        ...existing,
        ...(formSchema && { form_schema: formSchema }),
        ...(attachments?.length && {
          attachments: allAttachments as never,
        }),
        ...(stages?.length && {
          stages: mergeStages(existing.stages ?? [], stages),
        }),
        ...(incomingAnnotations.length && {
          annotations: mergeAnnotations(
            existing.annotations ?? [],
            incomingAnnotations,
          ),
        }),
        ...(state && { state }),
      },
    }),
  };
};
