export const getApiHeaders = ({
  chatId,
  jwt,
}: {
  jwt?: string;
  chatId?: string;
}): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Api-Key': process.env.OPENAI_API_KEY,
  };
  if (chatId) {
    headers['X-CONVERSATION-ID'] = chatId;
  }
  if (jwt) {
    headers['authorization'] = 'Bearer ' + jwt;
  }
  return headers;
};
