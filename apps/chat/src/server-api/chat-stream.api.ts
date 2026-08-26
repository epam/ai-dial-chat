import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import {
  createChatStreamApi,
  getBrowserTimezone,
} from '@epam/ai-dial-chat-hooks';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from './base';

export { SendCompletionDtoModeEnum as CompletionMode };
export type { ChatStreamCompletionOptions } from '@epam/ai-dial-chat-hooks';

const chatStreamApi = createChatStreamApi({
  getCsrfToken,
  setCsrfToken,
  completionsBasePath: ApiEndpoints.CONVERSATIONS,
  getTimezone: getBrowserTimezone,
});

export const { streamCompletion, stopCompletion } = chatStreamApi;
