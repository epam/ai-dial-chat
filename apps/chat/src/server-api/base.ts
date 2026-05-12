export enum ApiEndpoints {
  THEMES = '/api/themes',
  THEME_ICON = '/api/themes/icon',
}

type RequestMethod = 'GET' | 'POST' | 'PUT';

type RequestOptions = Omit<RequestInit, 'method' | 'body'> & {
  body?: unknown;
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
  if (typeof data !== 'object' || data === null) {
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
      if (data === null || data === undefined) {
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
  const { body, headers, ...restOptions } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(url, {
    ...restOptions,
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(headers ?? {}),
    },
    body: body == null ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Request failed with status ${response.status} for ${method} ${url}`,
    );
  }

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
