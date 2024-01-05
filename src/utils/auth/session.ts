import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';

import { errorsMessages } from '@/src/constants/errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isClientSessionValid(session: any | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return session && (session as any).data?.error !== 'RefreshAccessTokenError';
}

export function isServerSessionValid(session: Session | null) {
  if (
    process.env.AUTH_DISABLED === 'true' ||
    process.env.IS_IFRAME === 'true'
  ) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!session && (session as any).error !== 'RefreshAccessTokenError';
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
