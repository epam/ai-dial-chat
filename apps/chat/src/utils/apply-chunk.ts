import type { Message, Stage, StreamChunk } from '@epam/ai-dial-chat-shared';

const mergeStages = (existing: Stage[], incoming: Stage[]): Stage[] => {
  const result = [...existing];
  for (const stage of incoming) {
    const idx = result.findIndex((s) => s.index === stage.index);
    if (idx >= 0) {
      result[idx] = {
        ...result[idx],
        ...stage,
        name: (result[idx].name ?? '') + (stage.name ?? ''),
        content:
          (result[idx].content ?? '') + (stage.content ?? '') || undefined,
      };
    } else {
      result.push(stage);
    }
  }
  return result;
};

/**
 * Applies a single SSE stream chunk to the message list.
 *
 *
 * Attachments are accumulated: each chunk's attachments are appended to the
 * existing array rather than replacing it.
 *
 * @returns Updated message array, or `null` when the chunk carries no
 *   actionable data (empty content, no form_schema, and no attachments).
 */
export const applyChunkToMessages = (
  messages: Message[],
  messageIndex: number,
  chunk: StreamChunk,
): Message[] | null => {
  const delta = chunk.choices[0]?.delta;
  const content = delta?.content ?? '';
  const formSchema = delta?.custom_content?.form_schema;
  const attachments = delta?.custom_content?.attachments;
  const stages = delta?.custom_content?.stages;
  const hasContentUpdate = !!content || !!formSchema || !!attachments?.length || !!stages?.length;
  const responseId = delta?.responseId ?? (hasContentUpdate ? chunk.id : undefined);

  if (!hasContentUpdate && !responseId) return null;

  return messages.map((message, index) => {
    if (index !== messageIndex) return message;

    const hasCustomContentUpdate =
      formSchema || attachments?.length || stages?.length;

    return {
      ...message,
      content: content ? message.content + content : message.content,
      ...(responseId && { responseId }),
      ...(hasCustomContentUpdate && {
        custom_content: {
          ...message.custom_content,
          ...(formSchema && { form_schema: formSchema }),
          ...(attachments?.length && {
            attachments: [
              ...(message.custom_content?.attachments ?? []),
              ...attachments,
            ],
          }),
          ...(stages?.length && {
            stages: mergeStages(message.custom_content?.stages ?? [], stages),
          }),
        },
      }),
    };
  });
};
