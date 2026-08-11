interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  traceparent?: string;
}

export interface ApiErrorDetails {
  status?: number;
  message: string | null;
  traceId?: string;
}

interface ApiErrorResponse {
  json: () => Promise<unknown>;
  status?: number;
  headers?: { get: (name: string) => string | null };
  clone?: () => ApiErrorResponse;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isApiErrorBody = (value: unknown): value is ApiErrorBody => {
  if (!isRecord(value)) return false;

  const { message, error } = value;
  return (
    typeof message === 'string' ||
    (Array.isArray(message) &&
      message.every((item) => typeof item === 'string')) ||
    typeof error === 'string'
  );
};

/* Shared by `getApiErrorMessage` and `getApiErrorDetails` so both resolve a message from a
 * parsed error body in the exact same order: `message[]` joined, then `message`, then `error`. */
const resolveMessageFromBody = (body: unknown): string | null => {
  if (!isApiErrorBody(body)) return null;
  if (Array.isArray(body.message)) return body.message.join('\n');
  if (body.message) return body.message;
  if (body.error) return body.error;
  return null;
};

/*
 * W3C Trace Context shape: version `00`, 32 lowercase-hex trace ID (not all zero), 16
 * lowercase-hex span ID (not all zero), 2-hex flags. Mirrors the validity check
 * `apps/chat-api`'s `traceparentMiddleware`/`TraceparentErrorFilter` already apply before ever
 * emitting a `traceparent`, so a malformed/fabricated value can never reach the UI.
 */
const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;
const ALL_ZERO_TRACE_ID = '0'.repeat(32);
const ALL_ZERO_SPAN_ID = '0'.repeat(16);

const extractTraceId = (traceparent: unknown): string | undefined => {
  if (typeof traceparent !== 'string') return undefined;

  const match = TRACEPARENT_PATTERN.exec(traceparent);
  if (!match) return undefined;

  const [, traceId, spanId] = match;
  if (traceId === ALL_ZERO_TRACE_ID || spanId === ALL_ZERO_SPAN_ID) {
    return undefined;
  }

  return traceId;
};

const getErrorResponse = (error: unknown): ApiErrorResponse | undefined => {
  if (!isRecord(error)) return undefined;

  const response = error.response;
  if (!isRecord(response) || typeof response.json !== 'function') {
    return undefined;
  }

  return response as unknown as ApiErrorResponse;
};

/** True when the API indicates the conversation resource no longer exists at the path. */
export const isConversationNotFoundError = (error: unknown): boolean => {
  const response = getErrorResponse(error);
  if (!response?.status) return false;
  return response.status === 404;
};

/** HTTP status code carried by a thrown API error, or `undefined` if none is attached. */
export const getApiErrorStatus = (error: unknown): number | undefined =>
  getErrorResponse(error)?.status;

export const getApiErrorMessage = async (
  error: unknown,
): Promise<string | null> => {
  const response = getErrorResponse(error);
  if (response) {
    try {
      const body = await response.json();
      const message = resolveMessageFromBody(body);
      if (message !== null) return message;
    } catch {
      return null;
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return null;
};

/*
 * Normalizes any API error — a generated `@epam/ai-dial-chat-api-client` `ResponseError` or a raw
 * `base.ts` `ApiRequestError`, both of which retain the source `Response` — into one
 * `{ status?, message, traceId? }` shape.
 *
 * Resolution order: parse a `traceparent` from the JSON error body first; if the body has no
 * valid `traceparent` (or the body can't be parsed as JSON), fall back to the response's
 * `traceparent` header. The message resolves in the same order `getApiErrorMessage` already
 * uses, including its quirk of returning `null` (not falling back to `Error.message`) when the
 * body can't be parsed as JSON at all. `response.clone()` is used before reading the body so a
 * caller that also reads the same response elsewhere (e.g. via `getApiErrorMessage`) never hits
 * a "body already used" error.
 */
export const getApiErrorDetails = async (
  error: unknown,
): Promise<ApiErrorDetails> => {
  const response = getErrorResponse(error);
  const status = response?.status;

  let message: string | null = null;
  let bodyTraceId: string | undefined;
  let jsonBodyFailed = false;

  if (response) {
    try {
      const responseForBody =
        typeof response.clone === 'function' ? response.clone() : response;
      const body = await responseForBody.json();
      message = resolveMessageFromBody(body);
      if (isRecord(body)) {
        bodyTraceId = extractTraceId(body.traceparent);
      }
    } catch {
      jsonBodyFailed = true;
    }
  }

  if (
    !jsonBodyFailed &&
    message === null &&
    error instanceof Error &&
    error.message
  ) {
    message = error.message;
  }

  const traceId =
    bodyTraceId ??
    extractTraceId(
      typeof response?.headers?.get === 'function'
        ? response.headers.get('traceparent')
        : undefined,
    );

  return { status, message, traceId };
};
