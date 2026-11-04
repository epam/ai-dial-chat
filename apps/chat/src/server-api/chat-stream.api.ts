import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import {
  createChatStreamApi,
  getBrowserTimezone,
} from '@epam/ai-dial-chat-hooks';
import { getUiLanguage } from '../i18n/get-ui-language';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from './base';

export { SendCompletionDtoModeEnum as CompletionMode };

const chatStreamApi = createChatStreamApi({
  getCsrfToken,
  setCsrfToken,
  completionsBasePath: ApiEndpoints.CONVERSATIONS,
  getTimezone: getBrowserTimezone,
  getLanguage: getUiLanguage,
});

export const { streamCompletion, stopCompletion } = chatStreamApi;
