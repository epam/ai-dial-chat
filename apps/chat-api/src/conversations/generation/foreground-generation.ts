import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import type { ConversationMessageDto } from '../dto/conversation-message.dto';
import type { ForegroundGenerationDto } from '../dto/foreground-generation.dto';

/*
 * Pure helpers for the `foregroundGeneration` marker (`foreground-generation-lock`).
 * They import nothing from the background helpers, so `background-message.ts` can use
 * them without an import cycle; the conditional writes live in `foreground-message.ts`.
 */

/** Added to a marker's expiry so clock skew between instances never cuts a live generation short. */
export const FOREGROUND_EXPIRY_GRACE_MS = 60_000;

/** How often a streaming generation re-reads its conversation to honour a stored Stop. */
export const FOREGROUND_REREAD_INTERVAL_MS = 10_000;

/** How long module shutdown waits for foreground terminal and release writes. */
export const FOREGROUND_SHUTDOWN_FLUSH_MS = 10_000;

/** A message holding a conversation, with its index. */
export interface ActiveGenerationMessage {
  index: number;
  message: ConversationMessageDto;
}

/**
 * How long after a stored Stop a marker stops holding the conversation: long enough for a
 * live worker to notice it and write its stopped answer.
 * @param finalizeTimeoutMs - the configured `GENERATION_FINALIZE_TIMEOUT_MS`
 */
export const buildForegroundStopReleaseMs = (
  finalizeTimeoutMs: number,
): number => 2 * FOREGROUND_REREAD_INTERVAL_MS + finalizeTimeoutMs;

/**
 * The marker a start-state write stores for a generation.
 * @param params.generationId - client-supplied generation id
 * @param params.now - server time of the write
 * @param params.maxDurationMs - the configured `MAX_GENERATION_DURATION_MS`
 * @param params.finalizeTimeoutMs - the configured `GENERATION_FINALIZE_TIMEOUT_MS`
 */
export const buildForegroundMarker = (params: {
  generationId: string;
  now: number;
  maxDurationMs: number;
  finalizeTimeoutMs: number;
}): ForegroundGenerationDto => ({
  generationId: params.generationId,
  startedAt: params.now,
  expiresAt:
    params.now +
    params.maxDurationMs +
    params.finalizeTimeoutMs +
    FOREGROUND_EXPIRY_GRACE_MS,
});

/**
 * Whether a marker still holds its conversation at `now`.
 * @param marker - the stored marker, if any
 * @param now - the reading instance's clock
 */
export const isLiveForegroundMarker = (
  marker: ForegroundGenerationDto | undefined,
  now: number,
): boolean => marker != null && now < marker.expiresAt;

/**
 * Index of the message carrying the marker of `generationId`, live or not, or -1.
 * @param messages - conversation messages
 * @param generationId - generation id recorded on the marker
 */
export const findForegroundMessageIndex = (
  messages: ConversationMessageDto[] | undefined,
  generationId: string,
): number =>
  (messages ?? []).findIndex(
    (message) => message.foregroundGeneration?.generationId === generationId,
  );

/**
 * The message whose foreground marker is live at `now`, if any.
 * @param conversation - stored conversation
 * @param now - the reading instance's clock
 */
export const findLiveForegroundMessage = (
  conversation: { messages?: ConversationMessageDto[] } | undefined,
  now: number,
): ActiveGenerationMessage | null => {
  const messages = conversation?.messages ?? [];
  const index = messages.findIndex((message) =>
    isLiveForegroundMarker(message.foregroundGeneration, now),
  );
  return index === -1 ? null : { index, message: messages[index] };
};

/**
 * The message that holds the conversation — a pending background message or a live
 * foreground marker — or `null` when no generation is active.
 * @param conversation - stored conversation
 * @param now - the reading instance's clock
 */
export const findActiveGeneration = (
  conversation: { messages?: ConversationMessageDto[] } | undefined,
  now: number = Date.now(),
): ActiveGenerationMessage | null => {
  const messages = conversation?.messages ?? [];
  const pendingIndex = messages.findIndex(
    (message) =>
      message.backgroundGeneration?.status ===
      BackgroundGenerationStatus.Pending,
  );
  if (pendingIndex !== -1) {
    return { index: pendingIndex, message: messages[pendingIndex] };
  }
  return findLiveForegroundMessage(conversation, now);
};

/**
 * Returns `message` without its foreground marker; a message with no terminal markers is
 * marked interrupted (`streamErrorMessage: ''`).
 * @param message - message to neutralize
 */
export const withoutForegroundMarker = <T extends ConversationMessageDto>(
  message: T,
): T => {
  const stored = { ...message } as T & { wasStoppedByUser?: boolean };
  delete stored.foregroundGeneration;
  return stored.streamErrorMessage == null && !stored.wasStoppedByUser
    ? { ...stored, streamErrorMessage: '' }
    : stored;
};

/**
 * Returns `messages` with every foreground marker removed, except the one carrying
 * `keepGenerationId`. Only the backend may create a marker, so a client body or a copy
 * never holds one.
 * @param messages - messages to normalize
 * @param keepGenerationId - generation whose marker may stay, if any
 */
export const neutralizeForegroundMarkers = <T extends ConversationMessageDto>(
  messages: T[] | undefined,
  keepGenerationId?: string,
): T[] =>
  (messages ?? []).map((message) =>
    message.foregroundGeneration == null ||
    (keepGenerationId != null &&
      message.foregroundGeneration.generationId === keepGenerationId)
      ? message
      : withoutForegroundMarker(message),
  );
