import { Session } from 'next-auth';

import { createHash } from 'crypto';

const sha256 = (str: string) => createHash('sha256').update(str).digest('hex');

export const getHeaders = (session: Session, id?: string): HeadersInit => {
  const headers: HeadersInit = {
    'X-USER': sha256(session.user?.email ?? ''),
    'X-JOB-TITLE': (session as any).jobTitle,
  };
  if (id) {
    headers['X-CORRELATION-ID'] = id;
  }
  return headers;
};
