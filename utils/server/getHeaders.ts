import { Session } from 'next-auth';

import { OPENAI_API_TYPE, OPENAI_ORGANIZATION } from '@/utils/app/const';

import { createHash } from 'crypto';
import { validate } from 'uuid';

const sha256 = (str: string) => createHash('sha256').update(str).digest('hex');

export const getHeaders = (
  session: Session,
  id?: string,
): Record<string, string> => {
  const headers: HeadersInit = {
    'X-USER': sha256(session.user?.email ?? ''),
    'X-JOB-TITLE': (session as any).jobTitle,
  };
  if (id && validate(id)) {
    headers['X-CORRELATION-ID'] = id;
  }
  return headers;
};

export function extendWithOpenAIHeaders(
  key: string,
  headers: Record<string, string>,
): Record<string, string> {
  const apiKey = key ? key : process.env.OPENAI_API_KEY;
  return {
    'Content-Type': 'application/json',
    ...(OPENAI_API_TYPE === 'openai' &&
      apiKey && {
        Authorization: `Bearer ${apiKey}`,
      }),
    ...(OPENAI_API_TYPE === 'azure' &&
      apiKey && {
        'api-key': apiKey,
      }),
    ...(OPENAI_API_TYPE === 'openai' &&
      OPENAI_ORGANIZATION && {
        'OpenAI-Organization': OPENAI_ORGANIZATION,
      }),
    ...headers,
  };
}

export function extendWithBedrockHeaders(
  key: string,
  headers: Record<string, string>,
): Record<string, string> {
  const apiKey = key ? key : process.env.BEDROCK_API_KEY;
  return {
    'Content-Type': 'application/json',
    ...(apiKey && {
      'api-key': apiKey,
    }),
    ...headers,
  };
}

export function getOpenAIHeaders(
  session: Session | null,
  key: string,
  id?: string,
): Record<string, string> {
  return extendWithOpenAIHeaders(
    key,
    (session && getHeaders(session, id)) || {},
  );
}

export function getBedrockHeaders(
  session: Session | null,
  key: string,
  id?: string,
): Record<string, string> {
  return extendWithBedrockHeaders(
    key,
    (session && getHeaders(session, id)) || {},
  );
}
