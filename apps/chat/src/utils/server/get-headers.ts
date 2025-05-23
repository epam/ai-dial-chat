import { isAuthDisabled } from '@/src/utils/auth/auth-providers';

export const getApiHeaders = ({
  chatReference,
  jwt,
  jobTitle,
  ifNoneMatch,
}: {
  jwt?: string;
  chatReference?: string;
  jobTitle?: string;
  ifNoneMatch?: string;
}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (chatReference) {
    headers['X-CONVERSATION-ID'] = chatReference;
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
