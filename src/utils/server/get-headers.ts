import { validateToken } from '../auth/jwt-validator';

export const getApiHeaders = ({
  chatId,
  jwt,
  jobTitle,
}: {
  jwt?: string;
  chatId?: string;
  jobTitle?: string;
}): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Api-Key': process.env.OPENAI_API_KEY,
  };
  if (chatId) {
    headers['X-CONVERSATION-ID'] = chatId;
  }
  if (jwt) {
    validateToken(jwt);
    headers['authorization'] = 'Bearer ' + jwt;
  }
  if (jobTitle) {
    headers['X-JOB-TITLE'] = jobTitle;
  }
  return headers;
};
