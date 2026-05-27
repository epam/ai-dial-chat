import type { Message, StreamChunk } from '@epam/ai-dial-chat-shared';

/**
 * Applies a single SSE stream chunk to the message list.
 *
 * Extracts the text delta and optional `form_schema` from the chunk and
 * merges them into the assistant message identified by `assistantMessageId`.
 *
 * @returns Updated message array, or `null` when the chunk carries no
 *   actionable data (empty content and no form_schema).
 */
export const applyChunkToMessages = (
  messages: Message[],
  assistantMessageId: string,
  chunk: StreamChunk,
): Message[] | null => {
  const delta = chunk.choices[0]?.delta;
  const content = delta?.content ?? '';
  const formSchema = delta?.custom_content?.form_schema;

  if (!content && !formSchema) return null;

  return messages.map((message) => {
    if (message.id !== assistantMessageId) return message;
    return {
      ...message,
      content: content ? message.content + content : message.content,
      ...(formSchema && {
        custom_content: {
          ...message.custom_content,
          form_schema: formSchema,
        },
      }),
    };
  });
};
