export interface ErrorDetails {
  statusCode: number;
  message: string;
}

export const getErrorDetails = (
  error: unknown,
  fallbackStatusCode = 500,
  fallbackMessage = 'Unknown error',
): ErrorDetails => {
  if (typeof error !== 'object' || error == null) {
    return { statusCode: fallbackStatusCode, message: fallbackMessage };
  }

  const record = error as Record<string, unknown>;
  const statusCode =
    typeof record.status === 'number' ? record.status : fallbackStatusCode;
  const message =
    typeof record.message === 'string' ? record.message : fallbackMessage;

  return { statusCode, message };
};
