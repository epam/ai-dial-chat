import { getTraceIdFromTraceparent } from '@/src/utils/server/traceparent';

interface ErrorWithTraceparent {
  message?: string;
  errorMessage?: string;
  traceparent?: string;
}

export const parseApiError = (error?: { message?: string }) => {
  let message: string | undefined = undefined;
  let traceId: string | undefined = undefined;

  try {
    const parsedMessage: ErrorWithTraceparent = JSON.parse(
      error?.message ?? '',
    );
    message = parsedMessage.message ?? parsedMessage.errorMessage ?? undefined;
    traceId = getTraceIdFromTraceparent(parsedMessage.traceparent);
  } catch {
    message = error?.message;
  }

  return { message, traceId };
};
