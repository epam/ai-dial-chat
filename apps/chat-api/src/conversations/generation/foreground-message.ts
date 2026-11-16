import { HttpException } from '@nestjs/common';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConditionalUpdateStatus,
  type ConversationPersistencePort,
  type VersionedConversation,
} from '../conversation-persistence.port';
import type { ConversationMessageDto } from '../dto/conversation-message.dto';
import {
  BackgroundWriteResult,
  withServerOwnedFields,
  type ServerOwnedMessageFields,
  type StoredMessage,
} from './background-message';
import {
  findForegroundMessageIndex,
  isLiveForegroundMarker,
} from './foreground-generation';

/** Outcome of a write that applies only while the generation's own marker is stored. */
export interface ForegroundWriteOutcome {
  result: BackgroundWriteResult;
  /** The conversation as saved (applied). */
  conversation?: ConversationResponseDto;
  /** Every attempt met a newer version. */
  isConflict?: boolean;
}

/**
 * Writes the message of foreground generation `generationId` only while it still carries
 * that generation's marker (`foreground-generation-lock`): locates it in the latest stored
 * version, replaces its server-owned fields with `mutate`'s complete set (a marker the set
 * omits is removed), keeps its client-owned fields and every other message, and saves with
 * `If-Match` through `updateConversation`. A version read without an `ETag` is never
 * written, because such a write could not be fenced.
 * @param params.persistence - conversation persistence port
 * @param params.conversationPath - conversation path relative to `bucket`
 * @param params.token - bearer token of the generation
 * @param params.bucket - caller's session bucket
 * @param params.generationId - generation that owns the message
 * @param params.mutate - builds the complete new server-owned field set from the stored message
 * @param params.mutateConversation - adjusts conversation-level fields of the version written
 * @param params.initial - a version the caller already holds, used for the first attempt
 */
export const updateForegroundMessage = async (params: {
  persistence: Pick<ConversationPersistencePort, 'updateConversation'>;
  conversationPath: string;
  token: string;
  bucket: string;
  generationId: string;
  mutate: (stored: StoredMessage) => ServerOwnedMessageFields;
  mutateConversation?: (
    conversation: ConversationResponseDto,
  ) => ConversationResponseDto;
  initial?: VersionedConversation;
}): Promise<ForegroundWriteOutcome> => {
  let skipped: BackgroundWriteResult = BackgroundWriteResult.Skipped;
  const update = await params.persistence.updateConversation(
    params.conversationPath,
    params.token,
    params.bucket,
    (stored) => {
      skipped = BackgroundWriteResult.Skipped;
      if (!stored) return null;
      const messages = (stored.conversation.messages ??
        []) as ConversationMessageDto[];
      const index = findForegroundMessageIndex(messages, params.generationId);
      if (index === -1) return null;
      if (!stored.etag) {
        skipped = BackgroundWriteResult.Failed;
        return null;
      }
      const nextMessages = [...messages];
      nextMessages[index] = withServerOwnedFields(
        messages[index],
        params.mutate(messages[index] as StoredMessage),
      );
      const next = {
        ...stored.conversation,
        messages: nextMessages,
      } as ConversationResponseDto;
      return params.mutateConversation ? params.mutateConversation(next) : next;
    },
    params.initial,
  );
  switch (update.status) {
    case ConditionalUpdateStatus.Saved:
      return {
        result: BackgroundWriteResult.Applied,
        conversation: update.conversation,
      };
    case ConditionalUpdateStatus.Skipped:
      return { result: skipped };
    default:
      return { result: BackgroundWriteResult.Failed, isConflict: true };
  }
};

/**
 * The server-owned fields of a release write: the marker is removed and the placeholder
 * is marked interrupted, keeping whatever content it already has.
 * @param stored - the stored marked message
 */
export const releasedForegroundFields = (
  stored: StoredMessage,
): ServerOwnedMessageFields => ({
  content: stored.content,
  custom_content: stored.custom_content,
  responseId: stored.responseId,
  streamErrorMessage: stored.wasStoppedByUser
    ? stored.streamErrorMessage
    : (stored.streamErrorMessage ?? ''),
  wasStoppedByUser: stored.wasStoppedByUser,
});

/** Outcome of storing a Stop on a foreground generation's marker. */
export enum ForegroundStopResult {
  /** The Stop was stored on the live marker. */
  Stored = 'stored',
  /** The live marker already carried a Stop; nothing was written. */
  AlreadyRequested = 'already_requested',
  /** No live marker carries the id, or the conversation could not be read; use the registry path. */
  NotFound = 'not_found',
  /** The write could not be stored or fenced; the Stop may be retried. */
  Failed = 'failed',
}

/** Why storing a Stop threw: the HTTP status when there is one, never a message or a body. */
export interface ForegroundStopErrorDetails {
  status?: number;
  errorName: string;
  /** True once the conversation was read, so the failure came from the conditional write. */
  isRead: boolean;
}

/* A refused read or write discloses nothing: the caller cannot see this conversation. */
const isAccessRefusal = (error: unknown): boolean =>
  error instanceof HttpException && [403, 404].includes(error.getStatus());

/**
 * Stores a Stop on the live marker of `generationId` with the stopping caller's own token,
 * and shortens its expiry so a marker whose worker is gone stops holding the conversation
 * soon after (`foreground-generation-lock`). DIAL Core authorizes the write.
 * @param params.persistence - conversation persistence port
 * @param params.conversationPath - conversation path relative to `bucket`
 * @param params.token - bearer token of the stopping caller
 * @param params.bucket - stopping caller's session bucket
 * @param params.generationId - generation to stop
 * @param params.stopReleaseMs - how long after the Stop the marker may still hold the conversation
 * @param params.onError - called when the read or write threw, so the caller can log why the Stop was not stored
 */
export const storeForegroundStop = async (params: {
  persistence: Pick<ConversationPersistencePort, 'updateConversation'>;
  conversationPath: string;
  token: string;
  bucket: string;
  generationId: string;
  stopReleaseMs: number;
  onError?: (details: ForegroundStopErrorDetails) => void;
}): Promise<ForegroundStopResult> => {
  let isRead = false;
  let skipped = ForegroundStopResult.NotFound;
  try {
    const update = await params.persistence.updateConversation(
      params.conversationPath,
      params.token,
      params.bucket,
      (stored) => {
        isRead = true;
        skipped = ForegroundStopResult.NotFound;
        if (!stored) return null;
        const now = Date.now();
        const messages = (stored.conversation.messages ??
          []) as ConversationMessageDto[];
        const index = findForegroundMessageIndex(messages, params.generationId);
        const marker = messages[index]?.foregroundGeneration;
        if (!marker || !isLiveForegroundMarker(marker, now)) return null;
        if (marker.stopRequestedAt != null) {
          skipped = ForegroundStopResult.AlreadyRequested;
          return null;
        }
        if (!stored.etag) {
          skipped = ForegroundStopResult.Failed;
          return null;
        }
        const nextMessages = [...messages];
        nextMessages[index] = {
          ...messages[index],
          foregroundGeneration: {
            ...marker,
            stopRequestedAt: now,
            expiresAt: Math.min(marker.expiresAt, now + params.stopReleaseMs),
          },
        };
        return {
          ...stored.conversation,
          messages: nextMessages,
        } as ConversationResponseDto;
      },
    );
    if (update.status === ConditionalUpdateStatus.Saved) {
      return ForegroundStopResult.Stored;
    }
    return update.status === ConditionalUpdateStatus.Skipped
      ? skipped
      : ForegroundStopResult.Failed;
  } catch (error) {
    /* A refusal is the normal answer for a generation this caller does not own, so it is not reported. */
    if (!isAccessRefusal(error)) {
      params.onError?.({
        status: error instanceof HttpException ? error.getStatus() : undefined,
        errorName: error instanceof Error ? error.name : 'unknown',
        isRead,
      });
    }
    if (!isRead || isAccessRefusal(error)) return ForegroundStopResult.NotFound;
    return ForegroundStopResult.Failed;
  }
};
