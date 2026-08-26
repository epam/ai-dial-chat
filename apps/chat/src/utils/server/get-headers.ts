import { isAuthDisabled } from '@/src/utils/auth/auth-providers';

export const getApiHeaders = ({
  chatReference,
  jwt,
  jobTitle,
  language,
  timezone,
  ifNoneMatch,
}: {
  jwt?: string;
  chatReference?: string;
  jobTitle?: string;
  language?: string;
  timezone?: string;
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

  const proxyLanguageHeader =
    process.env.PROXY_LANGUAGE_HEADER || 'accept-language';
  if (proxyLanguageHeader && language) {
    headers[proxyLanguageHeader] = language;
  }

  if (timezone) {
    headers['X-Timezone'] = timezone;
  }

  if (jobTitle) {
    headers['X-JOB-TITLE'] = jobTitle;
  }

  if (ifNoneMatch) {
    headers['If-None-Match'] = ifNoneMatch;
  }
  return headers;
};
