import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';

import { errorsMessages } from '@/src/constants/errors';

import { isAuthDisabled } from './auth-providers';

export function isClientSessionValid(session: unknown | null) {
  return (
    session &&
    (session as { data?: { error?: string } }).data?.error !==
      'RefreshAccessTokenError'
  );
}

export function isServerSessionValid(session: Session | null) {
  if (isAuthDisabled || process.env.IS_IFRAME === 'true') {
    return true;
  }

  return (
    !!session &&
    (session as { error?: string }).error !== 'RefreshAccessTokenError'
  );
}

export function validateServerSession(
  session: Session | null,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isServerSessionValid(session)) {
    res.status(401).send(errorsMessages[401]);

    return false;
  }

  return true;
}
