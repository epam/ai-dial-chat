import type { ConversationStreamTransport } from '@epam/ai-dial-chat-hooks';
import type { Conversation } from '@epam/ai-dial-chat-shared';
import {
  streamCompletion,
  stopCompletion,
} from '../server-api/chat-stream.api';
import {
  getConversation,
  watchConversation,
} from '../server-api/conversations.api';

/**
 * App-owned implementation of the library's `ConversationStreamTransport`
 * contract, wrapping the BFF fetch/CSRF/SSE-decoding logic in
 * `server-api/chat-stream.api.ts` and the generated-client calls in
 * `server-api/conversations.api.ts`. Never re-exposed as a hook — it holds
 * no state of its own.
 */
export const conversationStreamTransport: ConversationStreamTransport = {
  streamCompletion: (
    path,
    message,
    model,
    options,
    customContent,
    generationId,
    mode,
    messageIndex,
    clientChannelId,
  ) =>
    streamCompletion(
      path,
      message,
      model,
      options,
      customContent,
      generationId,
      mode,
      messageIndex,
      clientChannelId,
    ),
  stopCompletion: (params) => stopCompletion(params),
  watchConversation: (path, signal) => watchConversation(path, signal),
  getConversation: async (conversationId, signal) =>
    (await getConversation(conversationId, signal)) as Conversation,
};
