export enum ApiEndpoints {
  THEMES = '/api/themes',
  THEME_ICON = '/api/themes/icon',
  CHAT_COMPLETIONS = '/api/v1/chat/completions',
  CONVERSATIONS = '/api/v1/conversations',
  MODELS = '/api/v1/models',
  AUTH_ME = '/api/v1/auth/me',
  AUTH_LOGOUT = '/api/v1/auth/logout',
  TRANSCRIPTION = '/api/v1/transcription',
  CLIENT_CHANNEL = '/api/v1/client-channel',
  EXTERNAL_SERVICES = '/api/v1/external-services',
}

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(public readonly url: string) {
    super(`Unauthorized: ${url}`);
    this.name = 'UnauthorizedError';
  }
}

/*
 * Thrown for any non-ok response from `request()` that isn't a 401. Carries the original
 * `Response` (cloned before its body is consumed for the CSRF check below) so
 * `getApiErrorDetails` in `api-error.ts` can resolve a message/traceId from it identically to a
 * generated-client `ResponseError`, which also retains its source `Response`.
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly response: Response,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export enum CsrfRefreshStatus {
  Ok = 'ok',
  Unauthorized = 'unauthorized',
  Failed = 'failed',
}

export type CsrfRefreshResult =
  | { status: CsrfRefreshStatus.Ok; token: string }
  | { status: CsrfRefreshStatus.Unauthorized | CsrfRefreshStatus.Failed };

enum CsrfErrorCode {
  Invalid = 'CSRF_INVALID',
}

type UnauthorizedListener = (url: string) => void;
const listeners = new Set<UnauthorizedListener>();

let _csrfToken: string | null = null;
export const setCsrfToken = (token: string | null): void => {
  _csrfToken = token;
};
export const getCsrfToken = (): string | null => _csrfToken;
export const clearCsrfToken = (): void => {
  _csrfToken = null;
};

export const onUnauthorized = (
  listener: UnauthorizedListener,
): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notifyUnauthorized = (url: string): void => {
  clearCsrfToken();
  listeners.forEach((l) => l(url));
};

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type RequestOptions = Omit<RequestInit, 'method' | 'body'> & {
  body?: unknown;
  responseHandler?: (response: Response) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasInvalidCsrfMessage = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.includes('Invalid CSRF token');
  }

  if (Array.isArray(value)) {
    return value.some(hasInvalidCsrfMessage);
  }

  return false;
};

export const isInvalidCsrfErrorBody = (body: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) {
      return hasInvalidCsrfMessage(parsed);
    }

    if (parsed.code === CsrfErrorCode.Invalid) {
      return true;
    }

    return (
      parsed.statusCode === 403 &&
      parsed.error === 'Forbidden' &&
      hasInvalidCsrfMessage(parsed.message)
    );
  } catch {
    return body.includes('Invalid CSRF token');
  }
};

let csrfRefreshPromise: Promise<CsrfRefreshResult> | null = null;

const runCsrfRefresh = async (): Promise<CsrfRefreshResult> => {
  let response: Response;
  try {
    response = await fetch(ApiEndpoints.AUTH_ME, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    return { status: CsrfRefreshStatus.Failed };
  }

  if (response.status === 401) {
    clearCsrfToken();
    return { status: CsrfRefreshStatus.Unauthorized };
  }

  const csrfToken = response.headers.get('x-csrf-token');
  if (response.ok && csrfToken != null) {
    setCsrfToken(csrfToken);
    return { status: CsrfRefreshStatus.Ok, token: csrfToken };
  }

  return { status: CsrfRefreshStatus.Failed };
};

export const refreshCsrfToken = (): Promise<CsrfRefreshResult> => {
  csrfRefreshPromise ??= runCsrfRefresh().finally(() => {
    csrfRefreshPromise = null;
  });
  return csrfRefreshPromise;
};

// Type guard for validating response structure
export const isValidResponse = <T>(
  data: unknown,
  validator: (data: unknown) => data is T,
): data is T => {
  return validator(data);
};

// Validator for unknown responses (basic structure check)
export const hasRequiredProperties = <T extends Record<string, unknown>>(
  data: unknown,
  properties: Array<keyof T>,
): data is T => {
  if (typeof data !== 'object' || data == null) {
    return false;
  }
  return properties.every((prop) => prop in data);
};

const parseResponse = async <TResponse>(
  response: Response,
): Promise<TResponse> => {
  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();
      // Basic validation: check if data is not null/undefined
      if (data == null) {
        throw new Error('Received null or undefined response data');
      }
      return data as TResponse;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse JSON response: malformed JSON');
      }
      throw error;
    }
  }

  return (await response.text()) as TResponse;
};

const request = async <TResponse>(
  url: string,
  method: RequestMethod,
  options: RequestOptions = {},
  allowCsrfRetry = true,
): Promise<TResponse> => {
  const { body, headers, responseHandler, ...restOptions } = options;
  const isFormData = body instanceof FormData;
  const csrfTokenForRequest = _csrfToken;

  const response = await fetch(url, {
    ...restOptions,
    method,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(method !== 'GET' && _csrfToken ? { 'X-CSRF-Token': _csrfToken } : {}),
      ...(headers ?? {}),
    },
    body: body == null ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const rotatedCsrf = response.headers.get('x-csrf-token');
  if (rotatedCsrf) _csrfToken = rotatedCsrf;

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized(url);
      throw new UnauthorizedError(url);
    }
    const responseForError =
      typeof response.clone === 'function' ? response.clone() : response;
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      errorBody = '';
    }
    if (
      response.status === 403 &&
      isInvalidCsrfErrorBody(errorBody) &&
      allowCsrfRetry
    ) {
      if (_csrfToken !== null && _csrfToken !== csrfTokenForRequest) {
        // A concurrent request already refreshed the token; reuse it.
        return request(url, method, options, false);
      }
      const refreshed = await refreshCsrfToken();
      if (refreshed.status === CsrfRefreshStatus.Ok) {
        return request(url, method, options, false);
      }
      if (refreshed.status === CsrfRefreshStatus.Unauthorized) {
        notifyUnauthorized(ApiEndpoints.AUTH_ME);
        throw new UnauthorizedError(ApiEndpoints.AUTH_ME);
      }
      throw new Error(`CSRF refresh failed for ${method} ${url}`);
    }
    throw new ApiRequestError(
      `Request failed with status ${response.status} for ${method} ${url}: ${errorBody}`,
      responseForError,
    );
  }

  responseHandler?.(response);
  return parseResponse<TResponse>(response);
};

export const get = <TResponse>(
  url: string,
  options?: Omit<RequestOptions, 'body'>,
) => request<TResponse>(url, 'GET', options);

export const post = <TResponse>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
) => request<TResponse>(url, 'POST', { ...options, body });

export const put = <TResponse>(
  url: string,
  body?: unknown,
  options?: RequestOptions,
) => request<TResponse>(url, 'PUT', { ...options, body });

export const del = <TResponse = void>(
  url: string,
  options?: Omit<RequestOptions, 'body'>,
) => request<TResponse>(url, 'DELETE', options);
