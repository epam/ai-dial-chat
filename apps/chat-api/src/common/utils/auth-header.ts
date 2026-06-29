export const getBearerAuthHeaders = (
  token: string,
): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});

export const getApiKeyAuthHeaders = (
  apiKey: string,
): { 'Api-Key': string } => ({
  'Api-Key': apiKey,
});
