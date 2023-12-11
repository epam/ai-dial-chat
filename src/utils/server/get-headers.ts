export const getApiHeaders = ({
  chatId,
  jwt,
  jobTitle,
}: {
  jwt?: string;
  chatId?: string;
  jobTitle?: string;
}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Api-Key': process.env.DIAL_API_KEY,
  };
  if (chatId) {
    headers['X-CONVERSATION-ID'] = chatId;
  }
  if (jwt) {
    headers['authorization'] = 'Bearer ' + jwt;
  }
  if (jobTitle) {
    headers['X-JOB-TITLE'] = jobTitle;
  }
  return headers;
};
