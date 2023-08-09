export const getApiHeaders = ({
  chatId,
  jwt,
  key,
}: {
  key?: string;
  jwt?: string;
  chatId?: string;
}): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (chatId) {
    headers['X-CONVERSATION-ID'] = chatId;
  }
  if (jwt) {
    headers['authorization'] = 'Bearer ' + jwt;
  }
  if (key) {
    headers['Api-Key'] = key;
  }
  console.log(headers)
  return headers;
};
