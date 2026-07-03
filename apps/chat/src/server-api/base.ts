export enum ApiEndpoints {
  THEMES = '/api/themes',
  THEME_ICON = '/api/themes/icon',
  CHAT_COMPLETIONS = '/api/v1/chat/completions',
  CONVERSATIONS = '/api/v1/conversations',
  MODELS = '/api/v1/models',
  AUTH_LOGOUT = '/api/v1/auth/logout',
  TRANSCRIPTION = '/api/v1/transcription',
}

export class UnauthorizedError extends Error {
  readonly status = 401 as const;
  constructor(public readonly url: string) {
    super(`Unauthorized: ${url}`);
    this.name = 'UnauthorizedError';
  }
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

const isInvalidCsrfErrorBody = (body: string): boolean =>
  body.includes('Invalid CSRF token');

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
): Promise<TResponse> => {
  const { body, headers, responseHandler, ...restOptions } = options;
  const isFormData = body instanceof FormData;

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
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      errorBody = '';
    }
    if (response.status === 403 && isInvalidCsrfErrorBody(errorBody)) {
      notifyUnauthorized(url);
    }
    throw new Error(
      `Request failed with status ${response.status} for ${method} ${url}: ${errorBody}`,
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
