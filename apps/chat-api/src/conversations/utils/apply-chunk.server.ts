import { AnnotationDto as Annotation } from '../dto/annotation.dto';
import { AttachmentDto as Attachment } from '../dto/attachment.dto';
import { ConversationMessageDto } from '../dto/conversation-message.dto';
import { StageDto as Stage } from '../dto/stage.dto';
import {
  mergeAnnotations,
  normalizeRawAnnotationsServer,
} from './apply-chunk-annotations.server';
import { mergeStages } from './apply-chunk-stages.server';

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
  const allAttachments = [
    ...(existing.attachments ?? []),
    ...(attachments ?? []),
  ];
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
