import { createPublishApiClient } from '@epam/ai-dial-chat-hooks';
import { publishApi } from './api-client';

/** Fetches the destination folder's already-configured access rules, shared by the conversation and catalog publish flows. */
export const getPublishRules =
  createPublishApiClient(publishApi).getPublishRules;
