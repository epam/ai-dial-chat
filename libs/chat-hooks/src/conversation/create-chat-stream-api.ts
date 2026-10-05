import type { SendCompletionDtoModeEnum } from '@epam/ai-dial-chat-api-client';
import type {
  MessageCustomContent,
  StreamChunk,
} from '@epam/ai-dial-chat-shared';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Status the completion endpoint returns when the conversation is already generating. */
const GENERATION_CONFLICT_STATUS = 409;

/** Safe fallback for hosts that do not supply a translated persistence warning. */
export const DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE =
  'The response could not be saved. It is still shown here, but may be lost if you reload or leave this page. Copy it before continuing.';

/** Identifies a failed terminal save independently of the model's generation outcome. */
export class GenerationPersistenceError extends Error {
  static readonly type = 'conversation_save_failed';

  constructor() {
    super(DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE);
    this.name = 'GenerationPersistenceError';
  }
}

/** Fallback text of a {@link GenerationConflictError} when no message is supplied. */
export const DEFAULT_GENERATION_CONFLICT_MESSAGE =
  'A response is already being generated in this conversation. Wait for it to finish or stop it before sending another message.';

/**
 * Reported through `onError` when the backend rejects a completion because
 * another generation is already active on the same conversation — what a
 * second browser tab of the same session hits when it submits into a
 * conversation the first tab is still generating. Distinct from a generic
 * transport failure so callers can present it as an expected state.
 */
export class GenerationConflictError extends Error {
  constructor(message: string = DEFAULT_GENERATION_CONFLICT_MESSAGE) {
    super(message);
    this.name = 'GenerationConflictError';
  }
}

/**
 * Reported through `onError` when DIAL Core itself signals a failure with an
 * in-band `{ error: { message } }` SSE chunk. Its `message` is upstream text
 * intended for the user, unlike a transport failure (failed `fetch`, non-OK
 * status, broken stream), whose message is technical detail. A custom
 * transport raises this for any user-facing upstream error text.
 */
export class StreamUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamUpstreamError';
  }
}

/**
 * Reported through `onError` when the network connection carrying a
 * completion stream is lost (a rejected `fetch`, or a read that fails after a
 * 2xx response) or goes silent past the idle timeout — what a laptop sleep or
 * a phone lock mid-generation produces. The backend-owned generation may
 * still be running, so the caller can recover it rather than treat the
 * response as failed. `cause` holds the original error, when there is one.
 */
export class StreamInterruptedError extends Error {
  constructor(cause?: unknown) {
    super('The completion stream was interrupted', { cause });
    this.name = 'StreamInterruptedError';
  }
}

/*
 * Three backend keepalive intervals (15 s each): one lost or late keepalive
 * plus jitter never trips it, while a dead socket is still caught promptly.
 */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 45_000;

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
  /**
   * How long an open completion stream may go without receiving a byte
   * (keepalive comments included) before it is reported as a
   * {@link StreamInterruptedError}. Defaults to {@link DEFAULT_STREAM_IDLE_TIMEOUT_MS}.
   */
  idleTimeoutMs?: number;
}

/**
 * Watches an open stream for silence. Re-armed on every received byte, and
 * re-checked immediately when the page becomes visible, the network comes
 * back, or the page is restored from the back/forward cache: timers are
 * frozen or throttled while a device sleeps, so waking is exactly when a dead
 * socket has to be noticed. A no-op outside a browser.
 */
const watchStreamIdle = (
  idleTimeoutMs: number,
  onIdle: () => void,
): { touch: () => void; stop: () => void } => {
  let lastByteAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  const check = () => {
    if (isStopped) return;
    const idleFor = Date.now() - lastByteAt;
    if (idleFor >= idleTimeoutMs) {
      onIdle();
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(check, idleTimeoutMs - idleFor);
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') check();
  };

  const hasDom =
    typeof window !== 'undefined' && typeof document !== 'undefined';
  if (hasDom) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', check);
    window.addEventListener('pageshow', check);
  }
  timer = setTimeout(check, idleTimeoutMs);

  return {
    touch: () => {
      lastByteAt = Date.now();
    },
    stop: () => {
      if (isStopped) return;
      isStopped = true;
      clearTimeout(timer);
      if (hasDom) {
        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );
        window.removeEventListener('online', check);
        window.removeEventListener('pageshow', check);
      }
    },
  };
};

/*
 * Matched by name, not `instanceof Error`: an aborted `fetch` rejects with a
 * `DOMException`, which is not an `Error` instance in every runtime.
 */
const isAbortError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err != null &&
  (err as { name?: unknown }).name === 'AbortError';

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
      onError(
        parsed.error.type === GenerationPersistenceError.type
          ? new GenerationPersistenceError()
          : new StreamUpstreamError(parsed.error.message),
      );
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
    content?: string;
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
    content?: string;
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
        if (isAbortError(err)) return;
        onError(new StreamInterruptedError(err));
        return;
      }

      const rotatedCsrf = response.headers.get('x-csrf-token');
      if (rotatedCsrf) deps.setCsrfToken(rotatedCsrf);

      if (!response.ok) {
        if (response.status === GENERATION_CONFLICT_STATUS) {
          onError(new GenerationConflictError());
          return;
        }
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
      /* Exactly one of `onComplete`/`onError` is reported per stream. */
      let isSettled = false;
      /* Set once the idle watchdog cancels the reader: nothing read after that is delivered. */
      let isCancelledForIdle = false;

      const handleError = (err: Error) => {
        if (isSettled) return;
        isSettled = true;
        idleWatch.stop();
        onError(err);
      };
      /*
       * The reader is cancelled by this transport, not through the caller's
       * `signal`: that signal belongs to the caller's generation lifecycle,
       * and aborting it would read as a user stop or a superseding request.
       */
      const idleWatch = watchStreamIdle(
        deps.idleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS,
        () => {
          isCancelledForIdle = true;
          handleError(new StreamInterruptedError());
          reader.cancel().catch(() => undefined);
        },
      );

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (isCancelledForIdle) break;

          if (done) {
            if (buffer.trim()) parseSSELine(buffer, onChunk, handleError);
            break;
          }
          idleWatch.touch();

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            parseSSELine(line, onChunk, handleError);
          }
        }
        if (!isSettled) {
          isSettled = true;
          onComplete();
        }
      } catch (err) {
        if (isAbortError(err)) return;
        handleError(new StreamInterruptedError(err));
      } finally {
        idleWatch.stop();
        reader.releaseLock();
      }
    };

    run();
  };

  return { streamCompletion, stopCompletion };
};
