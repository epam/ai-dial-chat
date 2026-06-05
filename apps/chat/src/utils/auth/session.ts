import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';

import { errorsMessages } from '@/src/constants/errors';

import { isAuthDisabled } from './auth-providers';

export function isClientSessionValid(session: unknown | null) {
  return (
    session &&
    ![
      'RefreshAccessTokenError',
      'CredentialsAccessTokenValidationError',
      'CredentialsAccessTokenExpired',
    ].includes((session as { data?: { error?: string } }).data?.error ?? '')
  );
}

export function isServerSessionValid(
  session: Session | null,
  checkForOverlay?: boolean,
) {
  if (
    isAuthDisabled ||
    (!checkForOverlay && process.env.IS_IFRAME === 'true')
  ) {
    return true;
  }

  return (
    !!session &&
    ![
      'RefreshAccessTokenError',
      'CredentialsAccessTokenValidationError',
      'CredentialsAccessTokenExpired',
    ].includes((session as { error?: string }).error ?? '')
  );
}

export function validateServerSession(
  session: Session | null,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // API routes must always enforce auth, even in overlay (IS_IFRAME) mode.
  // The overlay page-level bypass in isServerSessionValid is intentional for
  // server-side props (so the page shell renders), but API proxies should
  // never forward requests with an invalid or expired session to DIAL Core.
  if (!isServerSessionValid(session, true)) {
    res.status(401).send(errorsMessages[401]);

    return false;
  }

  return true;
}
