import type { MessageRating } from '@epam/ai-dial-chat-shared';
import { ApiEndpoints, post } from './base.js';

/** Request body for the rate-message endpoint. */
export interface RateMessageRequest {
  /** Identifier of the conversation containing the rated message. */
  conversationId: string;
  /** Identifier of the assistant response message being rated. */
  responseId: string;
  /** Model deployment ID that produced the response. */
  modelId: string;
  /** Rating value — `MessageRating.Like` (1) for thumbs-up, `MessageRating.Dislike` (-1) for thumbs-down. */
  rate: MessageRating;
  /** Optional free-text comment from the user. */
  comment?: string;
}

/**
 * Submits a like/dislike rating for an assistant message.
 * Proxied via the BFF to DIAL Core.
 */
export const rateMessage = (body: RateMessageRequest): Promise<void> =>
  post<void>(ApiEndpoints.RATE, body);
