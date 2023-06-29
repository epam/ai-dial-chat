import { Session } from 'next-auth';

import { OPENAI_API_TYPE, OPENAI_ORGANIZATION } from '@/utils/app/const';

import { createHash } from 'crypto';
import { validate } from 'uuid';

const sha256 = (str: string) => createHash('sha256').update(str).digest('hex');

export const getHeaders = (session: Session, id?: string): HeadersInit => {
  const headers: HeadersInit = {
    'X-USER': sha256(session.user?.email ?? ''),
    'X-JOB-TITLE': (session as any).jobTitle,
  };
  if (id && validate(id)) {
    headers['X-CORRELATION-ID'] = id;
  }
  return headers;
};

export function getOpenAIHeaders(session: Session, key: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(OPENAI_API_TYPE === 'openai' && {
      Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
    }),
    ...(OPENAI_API_TYPE === 'azure' && {
      'api-key': `${key ? key : process.env.OPENAI_API_KEY}`,
    }),
    ...(OPENAI_API_TYPE === 'openai' &&
      OPENAI_ORGANIZATION && {
        'OpenAI-Organization': OPENAI_ORGANIZATION,
      }),
    ...getHeaders(session),
  };
}
