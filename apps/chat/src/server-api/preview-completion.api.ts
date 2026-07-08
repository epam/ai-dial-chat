import { MessageRole, StreamChunk } from '@epam/ai-dial-chat-shared';
import { JSON_HEADERS } from '../constants/http';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from './base';
import { parseSSELine } from './chat-stream.api';

export interface PreviewMessage {
  role: MessageRole.User | MessageRole.Assistant;
  content: string;
}

export interface StreamPreviewCompletionOptions {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal: AbortSignal;
}

/**
 * Streams a stateless preview completion: the full transcript is sent on
 * every call since nothing is persisted server-side (see
 * `apps/chat-api/src/conversations/conversation.service.ts#streamPreviewCompletion`).
 */
export const streamPreviewCompletion = (
  model: string,
  messages: PreviewMessage[],
  options: StreamPreviewCompletionOptions,
  generationId?: string,
): void => {
  const { onChunk, onComplete, onError, signal } = options;

  const run = async () => {
    let response: Response;
    try {
      response = await fetch(
        `${ApiEndpoints.CONVERSATIONS}/preview-completions`,
        {
          method: 'POST',
          credentials: 'include',
          signal,
          headers: {
            ...JSON_HEADERS,
            ...(getCsrfToken() != null
              ? { 'X-CSRF-Token': getCsrfToken() as string }
              : {}),
          },
          body: JSON.stringify({
            model,
            messages,
            ...(generationId != null && { generationId }),
          }),
        },
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const rotatedCsrf = response.headers.get('x-csrf-token');
    if (rotatedCsrf) setCsrfToken(rotatedCsrf);

    if (!response.ok) {
      onError(
        new Error(
          `Preview stream request failed with status ${response.status}`,
        ),
      );
      return;
    }

    if (!response.body) {
      onError(new Error('No response body'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let hasError = false;

    const handleError = (err: Error) => {
      hasError = true;
      onError(err);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) parseSSELine(buffer, onChunk, handleError);
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          parseSSELine(line, onChunk, handleError);
        }
      }
      if (!hasError) onComplete();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      reader.releaseLock();
    }
  };

  run();
};
