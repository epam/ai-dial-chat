import type { RateMessageDto } from '@epam/ai-dial-chat-api-client';
import { rateApi } from './api-client';

/**
 * Submits a like/dislike rating for an assistant message.
 * Proxied via the BFF to DIAL Core through the generated API client.
 */
export const rateMessage = (body: RateMessageDto) =>
  rateApi.rateMessage({ rateMessageDto: body });
