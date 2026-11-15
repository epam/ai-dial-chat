import { type Conversation } from '@epam/ai-dial-chat-shared';
import {
  GenerationConflictError,
  GenerationPersistenceError,
  StreamUpstreamError,
} from '../create-chat-stream-api';
import { findPendingBackgroundMessageIndex } from './generation-resume';

/*
 * Pure helpers and constants of the conversation stream: error-text
 * resolution, the displayed conversation's background generation id, and
 * the channel-wait and Stop timing constants.
 */

/*
 * Bounded wait for the client-channel subscribe to resolve so that
 * completions sent right after mount can carry a channelId. 20 s gives
 * slow connections time to establish the channel while still being
 * meaningfully shorter than the 40 s subscribe default.
 */
export const CHANNEL_WAIT_TIMEOUT_MS = 20000;

/* Status of a terminal save that DIAL Core rejected for its credentials. */
export const UNAUTHORIZED_STATUS = 401;
/* Status of a Stop that found no active generation to stop. */
export const NOT_FOUND_STATUS = 404;
/*
 * A Stop that finds nothing to stop is expected when it lands just as the
 * generation ends; the stream's own end is seen within this window.
 */
export const STOP_NOT_FOUND_GRACE_MS = 2000;
export const STOP_NOT_FOUND_POLL_MS = 100;

/*
 * Picks the text written to `streamErrorMessage`. Only a conflict (host copy)
 * or an upstream DIAL Core error (upstream copy) is displayable; any other
 * error is transport detail and becomes '' so the host renders its localized
 * fallback ([#8979](https://github.com/epam/ai-dial-chat/issues/8979)).
 */
export const resolveStreamErrorMessage = (
  error: Error,
  generationConflictMessage: string,
  generationPersistenceErrorMessage: string,
): string => {
  if (error instanceof GenerationPersistenceError)
    return generationPersistenceErrorMessage;
  if (error instanceof GenerationConflictError)
    return generationConflictMessage;
  if (error instanceof StreamUpstreamError) return error.message;
  return '';
};

/** Generation id of the displayed conversation's pending background message, if any. */
export const findResumedBackgroundGenerationId = (
  conversation: Conversation | null,
): string | undefined => {
  if (!conversation) return undefined;
  const index = findPendingBackgroundMessageIndex(conversation);
  return index === -1
    ? undefined
    : conversation.messages[index].backgroundGeneration?.generationId;
};
