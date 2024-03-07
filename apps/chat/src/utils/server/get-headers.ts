import { isAuthDisabled } from '../auth/auth-providers';
import { ApiUtils } from './api';

export const getApiHeaders = ({
  chatId,
  jwt,
  jobTitle,
  ifNoneMatch,
}: {
  jwt?: string;
  chatId?: string;
  jobTitle?: string;
  ifNoneMatch?: string;
}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (chatId) {
    headers['X-CONVERSATION-ID'] = ApiUtils.safeEncodeURIComponent(chatId);
  }

  if (jwt) {
    headers['authorization'] = 'Bearer ' + jwt;
  } else if (isAuthDisabled) {
    headers['Api-Key'] = process.env.DIAL_API_KEY;
  }

  if (jobTitle) {
    headers['X-JOB-TITLE'] = jobTitle;
  }

  if (ifNoneMatch) {
    headers['If-None-Match'] = ifNoneMatch;
  }
  return headers;
};
