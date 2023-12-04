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
  };
  if (chatId) {
    headers['X-CONVERSATION-ID'] = chatId;
  }

  if (jwt) {
    headers['authorization'] = 'Bearer ' + jwt;
  } else {
    headers['Api-Key'] = process.env.OPENAI_API_KEY;
  }
  
  if (jobTitle) {
    headers['X-JOB-TITLE'] = jobTitle;
  }
  return headers;
};
