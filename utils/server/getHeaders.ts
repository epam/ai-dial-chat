export const getApiHeaders = (key: string): Record<string, string> => {
  const headers: HeadersInit = {
    'Api-Key': key,
  };
  return headers;
};

export const getAnalyticsHeaders = (chatId: string): Record<string, string> => {
  const headers: HeadersInit = {
    'X-CORRELATION-ID': chatId,
  };
  return headers;
};
