import { UnauthorizedException } from '@nestjs/common';
import { AuthProviderId } from '../providers/provider.types';
import type { SessionPayload } from './session.types';

/** Distinguishes a locally invalid cookie from a recoverable refresh race. */
export class InvalidSessionException extends UnauthorizedException {}

/** Enforces the server deadline before deriving a browser cookie lifetime. */
export const getSessionCookieMaxAge = (
  payload: SessionPayload,
  now = Math.floor(Date.now() / 1000),
): number => {
  if (
    !payload ||
    payload.v !== 2 ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.rt !== 'string' ||
    !Number.isSafeInteger(payload.session_exp) ||
    !Number.isSafeInteger(payload.at_exp) ||
    (payload.rt_exp !== undefined && !Number.isSafeInteger(payload.rt_exp))
  ) {
    throw new InvalidSessionException('Invalid session');
  }

  const tokenDeadline = payload.rt
    ? (payload.rt_exp ?? payload.session_exp)
    : payload.at_exp;
  const deadline = Math.min(payload.session_exp, tokenDeadline);
  if (deadline <= now) {
    throw new InvalidSessionException('Session expired');
  }
  return (deadline - now) * 1000;
};

/**
 * Keycloak's refresh_expires_in is provider-specific; zero advertises no bound.
 * A replacement token must never inherit another token's expiration timestamp.
 * Use the exchange start time so network latency cannot extend its lifetime.
 */
export const resolveRefreshTokenExpiry = (
  providerId: string,
  tokenSet: { refresh_token?: string; refresh_expires_in?: unknown },
  exchangeStartedAt: number,
  previous?: Pick<SessionPayload, 'rt' | 'rt_exp'>,
): number | undefined => {
  if (!(tokenSet.refresh_token ?? previous?.rt)) return undefined;

  if (providerId === AuthProviderId.Keycloak) {
    const lifetime = tokenSet.refresh_expires_in;
    if (lifetime === 0) return undefined;
    if (
      typeof lifetime === 'number' &&
      Number.isSafeInteger(lifetime) &&
      lifetime > 0 &&
      Number.isSafeInteger(exchangeStartedAt + lifetime)
    ) {
      return exchangeStartedAt + lifetime;
    }
  }

  return tokenSet.refresh_token && tokenSet.refresh_token !== previous?.rt
    ? undefined
    : previous?.rt_exp;
};
