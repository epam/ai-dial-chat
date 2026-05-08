interface ErrorWithTraceparent {
  message?: string;
  traceparent?: string;
}

export const parseApiError = (error?: { message?: string }) => {
  let message: string | undefined = undefined;
  let traceparent: string | undefined = undefined;

  try {
    const parsedMessage: ErrorWithTraceparent = JSON.parse(error?.message ?? '');
    message = parsedMessage.message ?? undefined;
    traceparent = parsedMessage.traceparent ?? undefined;
  } catch {
    message = error?.message;
  }

  return { message, traceparent };
}
