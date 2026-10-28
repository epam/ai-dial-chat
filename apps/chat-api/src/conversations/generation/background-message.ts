import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConditionalUpdateStatus,
  type ConditionalUpdateResult,
  type ConversationPersistencePort,
  type VersionedConversation,
} from '../conversation-persistence.port';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';

/**
 * Message fields only the backend may write while a background generation owns the
 * message. Every other field (for example `rating`) is client-owned.
 */
export const SERVER_OWNED_MESSAGE_FIELDS = [
  'content',
  'custom_content',
  'responseId',
  'backgroundGeneration',
  'streamErrorMessage',
  'wasStoppedByUser',
] as const;

/**
 * A persisted assistant message. `wasStoppedByUser` is written by the backend but is
 * not declared on `ConversationMessageDto`.
 */
export type StoredMessage = ConversationMessageDto & {
  wasStoppedByUser?: boolean;
};

export type ServerOwnedMessageFields = Pick<
  StoredMessage,
  (typeof SERVER_OWNED_MESSAGE_FIELDS)[number]
>;

/** Outcome of a write that is allowed only while the message is still pending. */
export enum BackgroundWriteResult {
  Applied = 'applied',
  /** The message is finished, was removed, or the conversation is gone. */
  Skipped = 'skipped',
  /** Storage kept rejecting the write, or it could not be fenced. */
  Failed = 'failed',
}

export interface BackgroundWriteOutcome {
  result: BackgroundWriteResult;
  /** The conversation as saved (applied) or as last read (skipped). */
  conversation?: ConversationResponseDto;
  /** The message carrying the generation id as last read, when it still exists. */
  storedMessage?: ConversationMessageDto;
}

/**
 * Index of the message produced by the background generation `generationId`, or -1.
 * @param messages - conversation messages
 * @param generationId - generation id recorded on the message
 */
export const findBackgroundMessageIndex = (
  messages: ConversationMessageDto[] | undefined,
  generationId: string,
): number =>
  (messages ?? []).findIndex(
    (message) => message.backgroundGeneration?.generationId === generationId,
  );

/**
 * The conversation's message that is still being generated in the background, if any.
 * @param conversation - stored conversation
 */
export const findPendingBackgroundMessage = (
  conversation: { messages?: ConversationMessageDto[] } | undefined,
): { index: number; message: ConversationMessageDto } | null => {
  const messages = (conversation?.messages ?? []) as ConversationMessageDto[];
  const index = messages.findIndex(
    (message) =>
      message.backgroundGeneration?.status ===
      BackgroundGenerationStatus.Pending,
  );
  return index === -1 ? null : { index, message: messages[index] };
};

/**
 * Replaces the server-owned fields of `message` with `serverOwned`, keeping every
 * client-owned field (e.g. `rating`) as it is. Fields absent from `serverOwned` are
 * removed, so a stale value can never survive a background write.
 * @param message - stored message
 * @param serverOwned - complete new set of server-owned fields
 */
export const withServerOwnedFields = (
  message: ConversationMessageDto,
  serverOwned: ServerOwnedMessageFields,
): ConversationMessageDto => {
  const clientOwned = { ...message } as Record<string, unknown>;
  for (const field of SERVER_OWNED_MESSAGE_FIELDS) delete clientOwned[field];
  return {
    ...(clientOwned as unknown as ConversationMessageDto),
    ...(Object.fromEntries(
      Object.entries(serverOwned).filter(([, value]) => value !== undefined),
    ) as ServerOwnedMessageFields),
  };
};

/**
 * The server-owned fields of `message`.
 * @param message - message to read
 */
export const pickServerOwnedFields = (
  message: StoredMessage,
): ServerOwnedMessageFields =>
  Object.fromEntries(
    SERVER_OWNED_MESSAGE_FIELDS.filter((field) => field in message).map(
      (field) => [field, message[field]],
    ),
  ) as ServerOwnedMessageFields;

/**
 * Writes a background generation's message only while it is still `pending`: locates
 * the message by `generationId` in the latest stored version, replaces its server-owned
 * fields in place (messages after it and client-owned fields are kept), and saves with
 * `If-Match` through `updateConversation`. A version read without an ETag is never
 * written, because such a write could not be fenced.
 * @param params.persistence - conversation persistence port
 * @param params.conversationPath - conversation path relative to `bucket`
 * @param params.token - bearer token of the request being served
 * @param params.bucket - caller's session bucket
 * @param params.generationId - generation that owns the message
 * @param params.mutate - builds the complete new server-owned field set from the stored message
 */
export const updatePendingBackgroundMessage = async (params: {
  persistence: ConversationPersistencePort;
  conversationPath: string;
  token: string;
  bucket: string;
  generationId: string;
  mutate: (stored: ConversationMessageDto) => ServerOwnedMessageFields;
}): Promise<BackgroundWriteOutcome> => {
  const { persistence, conversationPath, token, bucket, generationId, mutate } =
    params;
  let skipped: BackgroundWriteOutcome = {
    result: BackgroundWriteResult.Skipped,
  };
  let written: ConversationMessageDto | undefined;
  const update = await persistence.updateConversation(
    conversationPath,
    token,
    bucket,
    (stored) => {
      if (!stored) {
        skipped = { result: BackgroundWriteResult.Skipped };
        return null;
      }
      const messages = (stored.conversation.messages ??
        []) as ConversationMessageDto[];
      const index = findBackgroundMessageIndex(messages, generationId);
      const storedMessage = index === -1 ? undefined : messages[index];
      if (
        !storedMessage ||
        storedMessage.backgroundGeneration?.status !==
          BackgroundGenerationStatus.Pending
      ) {
        skipped = {
          result: BackgroundWriteResult.Skipped,
          conversation: stored.conversation,
          storedMessage,
        };
        return null;
      }
      if (!stored.etag) {
        skipped = { result: BackgroundWriteResult.Failed };
        return null;
      }
      const nextMessages = [...messages];
      nextMessages[index] = withServerOwnedFields(
        storedMessage,
        mutate(storedMessage),
      );
      written = nextMessages[index];
      return { ...stored.conversation, messages: nextMessages } as never;
    },
  );
  switch (update.status) {
    case ConditionalUpdateStatus.Saved:
      return {
        result: BackgroundWriteResult.Applied,
        conversation: update.conversation,
        storedMessage: written,
      };
    case ConditionalUpdateStatus.Skipped:
      return skipped;
    default:
      return { result: BackgroundWriteResult.Failed };
  }
};

/**
 * Applies `update` with `If-Match` through `updateConversation`. When conflicts persist,
 * reads the latest version once more: one holding a pending background message stays
 * a `Conflict`, because only `If-Match` keeps that message safe; any other one is saved
 * from that read unconditionally, the last-writer-wins save used before fencing.
 * @param persistence - conversation persistence port
 * @param conversationPath - conversation path relative to `bucket`
 * @param token - caller's bearer token
 * @param bucket - caller's session bucket
 * @param update - builds the body to save from the stored version
 */
export const updateConversationUnlessPending = async (
  persistence: Pick<
    ConversationPersistencePort,
    'updateConversation' | 'readConversationWithEtag' | 'saveConversation'
  >,
  conversationPath: string,
  token: string,
  bucket: string,
  update: (
    stored: VersionedConversation | null,
  ) => ConversationResponseDto | null,
): Promise<ConditionalUpdateResult> => {
  const result = await persistence.updateConversation(
    conversationPath,
    token,
    bucket,
    update,
  );
  if (result.status !== ConditionalUpdateStatus.Conflict) return result;
  const latest = await persistence.readConversationWithEtag(
    conversationPath,
    token,
    bucket,
  );
  if (findPendingBackgroundMessage(latest?.conversation)) return result;
  const body = update(latest);
  if (!body) return { status: ConditionalUpdateStatus.Skipped };
  return {
    status: ConditionalUpdateStatus.Saved,
    conversation: await persistence.saveConversation(
      conversationPath,
      token,
      bucket,
      body,
    ),
  };
};

/**
 * Returns `messages` with every `pending` background marker turned into `failed`
 * (with `streamErrorMessage: ''`), except the one owned by `keepGenerationId`. Used for
 * copies and client-sent bodies: only the backend may create a pending marker, so a
 * copy never shares the original's live DIAL Core job.
 * @param messages - messages to normalize
 * @param keepGenerationId - generation whose pending marker may stay, if any
 */
export const neutralizeForeignPendingMessages = <
  T extends ConversationMessageDto,
>(
  messages: T[] | undefined,
  keepGenerationId?: string,
): T[] =>
  (messages ?? []).map((message) => {
    const marker = message.backgroundGeneration;
    if (
      marker?.status !== BackgroundGenerationStatus.Pending ||
      marker.generationId === keepGenerationId
    ) {
      return message;
    }
    return {
      ...message,
      backgroundGeneration: {
        ...marker,
        status: BackgroundGenerationStatus.Failed,
      },
      streamErrorMessage: '',
    };
  });

/**
 * The messages to store for a client save. Storage stays authoritative for background
 * messages, because a client never receives the marker during a live stream and a
 * stale tab may still show an old state:
 * - the body's copy of a stored background message (pending or finished) takes that
 *   message's server-owned fields, so a client never changes a background answer. The
 *   copy is the body message carrying the same generation id or, when none does, an
 *   unmarked assistant message at the stored position. For a finished message the
 *   position counts only while the body still lines up with storage (same length, same
 *   preceding message), because deleting earlier messages shifts every position; a
 *   pending message cannot move, since messages are not deleted while it streams;
 * - when the body still has no copy of the stored pending message, the stored message
 *   replaces another generation's answer at its position (a tab that has not seen a
 *   regenerate), and a body too short to reach it gets the stored messages up to and
 *   including it;
 * - every other pending marker in the body is neutralized.
 * @param messages - messages sent by the client
 * @param storedMessages - messages currently in storage
 */
export const mergeClientMessages = (
  messages: StoredMessage[],
  storedMessages: StoredMessage[],
): StoredMessage[] => {
  const storedByGeneration = new Map(
    storedMessages
      .filter((message) => message.backgroundGeneration != null)
      .map((message) => [
        message.backgroundGeneration?.generationId as string,
        message,
      ]),
  );
  const merged = messages.map((message) => {
    const generationId = message.backgroundGeneration?.generationId;
    const stored = generationId
      ? storedByGeneration.get(generationId)
      : undefined;
    return stored
      ? withServerOwnedFields(message, pickServerOwnedFields(stored))
      : message;
  });
  const hasCopy = (generationId: string | undefined): boolean =>
    merged.some(
      (message) => message.backgroundGeneration?.generationId === generationId,
    );
  const isAligned = (index: number): boolean =>
    merged.length === storedMessages.length &&
    merged[index - 1]?.content === storedMessages[index - 1]?.content;
  storedMessages.forEach((stored, index) => {
    const generationId = stored.backgroundGeneration?.generationId;
    const atPosition = merged[index];
    const isPending =
      stored.backgroundGeneration?.status ===
      BackgroundGenerationStatus.Pending;
    if (
      generationId != null &&
      !hasCopy(generationId) &&
      (isPending || isAligned(index)) &&
      atPosition?.role === ConversationMessageRole.Assistant &&
      atPosition.backgroundGeneration == null
    ) {
      merged[index] = withServerOwnedFields(
        atPosition,
        pickServerOwnedFields(stored),
      );
    }
  });

  const pending = findPendingBackgroundMessage({ messages: storedMessages });
  const pendingGenerationId =
    pending?.message.backgroundGeneration?.generationId;
  if (pending && !hasCopy(pendingGenerationId)) {
    if (merged[pending.index]?.role === ConversationMessageRole.Assistant) {
      merged[pending.index] = pending.message;
    } else {
      const insertAt = Math.min(pending.index, merged.length);
      merged.splice(
        insertAt,
        0,
        ...storedMessages.slice(insertAt, pending.index + 1),
      );
    }
  }
  return neutralizeForeignPendingMessages(merged, pendingGenerationId);
};
