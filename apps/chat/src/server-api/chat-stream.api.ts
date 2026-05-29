import { MessageCustomContent, StreamChunk } from '@epam/ai-dial-chat-shared';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from './base';

export interface StreamCompletionOptions {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export const streamCompletion = (
  path: string,
  message: string,
  model: string,
  options: StreamCompletionOptions,
  customContent?: MessageCustomContent,
): void => {
  const { onChunk, onComplete, onError, signal } = options;

  const run = async () => {
    let response: Response;
    try {
      response = await fetch(`${ApiEndpoints.CONVERSATIONS}/completions`, {
        method: 'POST',
        credentials: 'include',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(getCsrfToken() !== null
            ? { 'X-CSRF-Token': getCsrfToken() as string }
            : {}),
        },
        body: JSON.stringify({
          path,
          message,
          model,
          custom_content: customContent || {},
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const rotatedCsrf = response.headers.get('x-csrf-token');
    if (rotatedCsrf) setCsrfToken(rotatedCsrf);

    if (!response.ok) {
      onError(
        new Error(`Stream request failed with status ${response.status}`),
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

const parseSSELine = (
  line: string,
  onChunk: (chunk: StreamChunk) => void,
  onError: (error: Error) => void,
): void => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return;
  if (!trimmed.startsWith('data: ')) return;

  const data = trimmed.slice(6);
  if (data === '[DONE]') return;

  try {
    const parsed = JSON.parse(data) as StreamChunk;
    if (parsed.error) {
      onError(new Error(parsed.error.message));
      return;
    }
    onChunk(parsed);
  } catch {
    // malformed chunk — skip silently
  }
};
