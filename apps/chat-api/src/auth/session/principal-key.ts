import { UnauthorizedException } from '@nestjs/common';
import { AuthSource } from '../auth-source.enum';
import { AuthErrorCode } from './auth-error-code.enum';
import type { SessionUser } from './session.types';

/*
 * Each component is percent-encoded before being joined with `:`, which is
 * what makes the composition injective: `encodeURIComponent` escapes both `:`
 * (→ `%3A`) and `%` (→ `%25`), so an encoded component can never contain the
 * separator and no two distinct component tuples can produce the same string.
 * `providerId="a"/sub="b:c"` → `h:a:b%3Ac`, `providerId="a:b"/sub="c"` →
 * `h:a%3Ab:c` — distinct, where naive concatenation would have collided.
 */
const NAMESPACE_COOKIE = 'c';
const NAMESPACE_HEADER = 'h';

const reject = (message: string): never => {
  throw new UnauthorizedException({
    code: AuthErrorCode.NoCredentials,
    error: 'Unauthorized',
    message,
    statusCode: 401,
  });
};

/**
 * Derives the stable **principal key** that owns a generation, from
 * server-verified identity only — the decrypted session payload's `sid` for a
 * cookie caller, and the verified (`providerId`, `sub`) pair for a header
 * caller. Never reads an owner identifier from a request body, query string,
 * route parameter, or any header other than the credential itself, and never
 * incorporates access-token material, so the key survives token renewal.
 *
 * The `c:` / `h:` prefixes put the two authentication modes in disjoint
 * namespaces: no encoded component can produce a prefix, so a cookie principal
 * and a header principal can never share a key even when their identity
 * components are textually equal.
 *
 * Branching on `authSource` rather than on "is `sid` present?" is deliberate:
 * `SessionGuard` sets it from the strategy that actually authenticated the
 * request, so an inconsistent `SessionUser` is a loud `401` instead of a
 * silent mis-attribution.
 *
 * Pure — no I/O, no injected dependencies. See
 * `generation-principal-ownership`.
 */
export const resolvePrincipalKey = (
  user: SessionUser,
  authSource: AuthSource | undefined,
): string => {
  switch (authSource) {
    case AuthSource.Cookie: {
      if (!user?.sid) {
        return reject('Cookie-authenticated session carries no session id');
      }
      return `${NAMESPACE_COOKIE}:${encodeURIComponent(user.sid)}`;
    }
    case AuthSource.Header: {
      if (!user?.providerId || !user?.sub) {
        return reject(
          'Header-authenticated request carries no verified principal',
        );
      }
      return `${NAMESPACE_HEADER}:${encodeURIComponent(
        user.providerId,
      )}:${encodeURIComponent(user.sub)}`;
    }
    default:
      return reject('Request has no recognised authentication source');
  }
};
