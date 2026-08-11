import { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import { MessageCustomContent, StreamChunk } from '@epam/ai-dial-chat-shared';
import { JSON_HEADERS } from '../constants/http';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from './base';

export { SendCompletionDtoModeEnum as CompletionMode };

export interface StreamCompletionOptions {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export const stopCompletion = async (dto: {
  generationId: string;
  path: string;
}): Promise<void> => {
  const response = await fetch(
    `${ApiEndpoints.CONVERSATIONS}/completions/stop`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...JSON_HEADERS,
        ...(getCsrfToken() != null
          ? { 'X-CSRF-Token': getCsrfToken() as string }
          : {}),
      },
      body: JSON.stringify(dto),
    },
  );

  const rotatedCsrf = response.headers.get('x-csrf-token');
  if (rotatedCsrf) setCsrfToken(rotatedCsrf);

  if (!response.ok) {
    throw new Error(`stopCompletion failed: ${response.status}`);
  }
};

export const streamCompletion = (
  path: string,
  message: string | undefined,
  model: string,
  options: StreamCompletionOptions,
  customContent?: MessageCustomContent,
  generationId?: string,
  mode?: SendCompletionDtoModeEnum,
  messageIndex?: number,
  clientChannelId?: string,
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
          ...JSON_HEADERS,
          ...(getCsrfToken() != null
            ? { 'X-CSRF-Token': getCsrfToken() as string }
            : {}),
        },
        body: JSON.stringify({
          path,
          message: message ?? '',
          model,
          custom_content: customContent || {},
          ...(generationId != null && { generationId }),
          ...(mode != null && { mode }),
          ...(messageIndex != null && { messageIndex }),
          ...(clientChannelId != null && { clientChannelId }),
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

export const parseSSELine = (
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
