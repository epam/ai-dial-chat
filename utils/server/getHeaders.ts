export const getHeaders = (key: string): Record<string, string> => {
  const headers: HeadersInit = {
    'Api-Key': key,
  };
  return headers;
};
