import type { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { textRefinementApi } from './api-client';

/** Refines an unsaved field with a server-owned purpose and caller cancellation. */
export const refineText = async (
  purpose: TextRefinementPurpose,
  text: string,
  signal: AbortSignal,
): Promise<string> => {
  const response = await textRefinementApi.refineText(
    { refineTextRequestDto: { purpose, text } },
    { signal },
  );
  return response.text;
};
