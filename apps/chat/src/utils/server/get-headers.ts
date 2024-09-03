import { isAuthDisabled } from '../auth/auth-providers';

export const getApiHeaders = ({
  chatId,
  jwt,
  jobTitle,
  ifNoneMatch,
  acceptLanguage,
}: {
  jwt?: string;
  chatId?: string;
  jobTitle?: string;
  ifNoneMatch?: string;
  acceptLanguage?: string;
}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (chatId) {
    headers['X-CONVERSATION-ID'] = encodeURIComponent(
      // eslint-disable-next-line no-misleading-character-class
      chatId.replace(/[\uD800-\uDBFF\uDC00-\uDFFF]+/gm, ''),
    );
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

  if (acceptLanguage) {
    headers['Accept-Language'] = acceptLanguage;
  }
  return headers;
};
