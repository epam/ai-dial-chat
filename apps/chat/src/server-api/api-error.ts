interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

interface ErrorWithResponse {
  response?: {
    json: () => Promise<unknown>;
    status?: number;
  };
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

const getErrorResponse = (error: unknown): ErrorWithResponse['response'] => {
  if (!isRecord(error)) return undefined;

  const response = error.response;
  if (!isRecord(response) || typeof response.json !== 'function') {
    return undefined;
  }

  return {
    json: response.json.bind(response),
    status: typeof response.status === 'number' ? response.status : undefined,
  };
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
      if (isApiErrorBody(body)) {
        if (Array.isArray(body.message)) return body.message.join('\n');
        if (body.message) return body.message;
        if (body.error) return body.error;
      }
    } catch {
      return null;
    }
  }

  if (error instanceof Error && error.message) return error.message;

  return null;
};
