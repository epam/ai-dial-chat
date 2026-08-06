import { ConversationMessageDto } from '../dto/conversation-message.dto';

/** Minimal types matching the DIAL Core SSE delta payload. */

interface StageAttachment {
  index?: number;
  title?: string;
  data?: string;
  [key: string]: unknown;
}

interface Stage {
  index?: number;
  name?: string;
  content?: string;
  attachments?: StageAttachment[];
  [key: string]: unknown;
}

interface AnnotationBody {
  title?: string;
  quote?: string;
  [key: string]: unknown;
}

interface Annotation {
  index?: number;
  body?: AnnotationBody;
  [key: string]: unknown;
}

interface SseDelta {
  content?: string;
  responseId?: string;
  custom_content?: {
    form_schema?: unknown;
    attachments?: unknown[];
    stages?: Stage[];
    annotations?: Annotation[];
    /** Orchestrator-specific execution state; arrives as a single complete snapshot, not accumulated across chunks. */
    state?: unknown;
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

const mergeAnnotations = (
  existing: Annotation[],
  incoming: Annotation[],
): Annotation[] => {
  const result = [...existing];
  for (const annotation of incoming) {
    const idx = result.findIndex((a) => a.index === annotation.index);
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
 * and responseId. Pure function — returns a new message object.
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
  const state = delta.custom_content?.state;

  const hasContentUpdate =
    !!content ||
    !!formSchema ||
    !!attachments?.length ||
    !!stages?.length ||
    !!annotations?.length ||
    !!state;

  const responseId =
    delta.responseId ?? (hasContentUpdate ? chunk.id : undefined);

  if (!hasContentUpdate && !responseId) return message;

  const existing = message.custom_content ?? {};
  const hasCustomUpdate =
    !!formSchema ||
    !!attachments?.length ||
    !!stages?.length ||
    !!annotations?.length ||
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
          attachments: [
            ...(existing.attachments ?? []),
            ...attachments,
          ] as never,
        }),
        ...(stages?.length && {
          stages: mergeStages(
            (existing as { stages?: Stage[] }).stages ?? [],
            stages,
          ) as never,
        }),
        ...(annotations?.length && {
          annotations: mergeAnnotations(
            (existing as { annotations?: Annotation[] }).annotations ?? [],
            annotations,
          ) as never,
        }),
        /*
         * Arrives as a single complete snapshot per turn (confirmed via
         * spike — not token-streamed like content), so it's replaced
         * wholesale rather than merged/accumulated like stages.
         */
        ...(state && { state: state as never }),
      },
    }),
  };
};
