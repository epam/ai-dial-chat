export const getBearerAuthHeaders = (
  token: string,
): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});
