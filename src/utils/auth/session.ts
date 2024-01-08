import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';

import { errorsMessages } from '@/src/constants/errors';

export function isClientSessionValid(
  session: (Session & { data?: { error?: string } }) | null,
) {
  return session && session.data?.error !== 'RefreshAccessTokenError';
}

export function isServerSessionValid(
  session: (Session & { error?: string }) | null,
) {
  if (
    process.env.AUTH_DISABLED === 'true' ||
    process.env.IS_IFRAME === 'true'
  ) {
    return true;
  }

  return !!session && session.error !== 'RefreshAccessTokenError';
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
