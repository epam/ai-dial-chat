import type { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import type {
  MessageCustomContent,
  StreamChunk,
} from '@epam/ai-dial-chat-shared';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Callbacks {@link streamCompletion} reports streamed completion events through. */
export interface ChatStreamCompletionOptions {
  onChunk: (chunk: StreamChunk) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

/** Host capabilities {@link createChatStreamApi} needs to stream and stop completions. */
export interface CreateChatStreamApiDeps {
  /** Returns the currently held CSRF token, or `null` when none is set. */
  getCsrfToken: () => string | null;
  /** Stores a CSRF token captured from a response header. */
  setCsrfToken: (token: string | null) => void;
  /** Base path for the completion/stop endpoints, e.g. `/api/v1/conversations`. */
  completionsBasePath: string;
  /** Resolves the caller's current timezone, attached as `X-Timezone` when non-empty. */
  getTimezone?: () => string | undefined;
  /** `fetch` implementation to issue requests through. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

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

/** DIAL Core completion streaming transport produced by {@link createChatStreamApi}. */
export interface ChatStreamApi {
  streamCompletion: (
    path: string,
    message: string | undefined,
    model: string,
    options: ChatStreamCompletionOptions,
    customContent?: MessageCustomContent,
    generationId?: string,
    mode?: SendCompletionDtoModeEnum,
    messageIndex?: number,
    clientChannelId?: string,
  ) => void;
  stopCompletion: (dto: {
    generationId: string;
    path: string;
  }) => Promise<void>;
}

/**
 * Builds the streamed-completion transport `apps/chat/src/server-api/chat-stream.api.ts`
 * exposes today: SSE parsing across partial chunks, CSRF header attachment
 * and rotation, and an optional timezone header, backed by an injected
 * `fetch` implementation and base path.
 */
export const createChatStreamApi = (
  deps: CreateChatStreamApiDeps,
): ChatStreamApi => {
  const { completionsBasePath } = deps;
  /*
   * Resolved per-call (not captured once at factory-construction time) so a
   * test's `vi.stubGlobal('fetch', ...)` — applied after this factory is
   * constructed at module load — still takes effect, matching the pre-move
   * implementation's direct global `fetch` reference.
   */
  const doFetch: typeof fetch = (...args) => (deps.fetchImpl ?? fetch)(...args);

  const stopCompletion = async (dto: {
    generationId: string;
    path: string;
  }): Promise<void> => {
    const response = await doFetch(`${completionsBasePath}/completions/stop`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...JSON_HEADERS,
        ...(deps.getCsrfToken() != null
          ? { 'X-CSRF-Token': deps.getCsrfToken() as string }
          : {}),
      },
      body: JSON.stringify(dto),
    });

    const rotatedCsrf = response.headers.get('x-csrf-token');
    if (rotatedCsrf) deps.setCsrfToken(rotatedCsrf);

    if (!response.ok) {
      throw new Error(`stopCompletion failed: ${response.status}`);
    }
  };

  const streamCompletion = (
    path: string,
    message: string | undefined,
    model: string,
    options: ChatStreamCompletionOptions,
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
        const timezone = deps.getTimezone?.();
        response = await doFetch(`${completionsBasePath}/completions`, {
          method: 'POST',
          credentials: 'include',
          signal,
          headers: {
            ...JSON_HEADERS,
            ...(deps.getCsrfToken() != null
              ? { 'X-CSRF-Token': deps.getCsrfToken() as string }
              : {}),
            ...(timezone ? { 'X-Timezone': timezone } : {}),
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
      if (rotatedCsrf) deps.setCsrfToken(rotatedCsrf);

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

  return { streamCompletion, stopCompletion };
};
