import type { Request, Response } from 'express';
import type { AuthSource } from '../auth-source.enum';
import type { SessionUser } from '../session/session.types';

/**
 * A single authentication credential source (cookie, header, ...). `SessionGuard`
 * and `OptionalSessionGuard` iterate an ordered list of these; `authenticate`
 * throwing signals a hard failure for a supported request — it must not cause
 * the guard to fall through to the next strategy in the chain.
 */
export interface AuthStrategy {
  readonly source: AuthSource;

  /** Whether this strategy's credential is present on the request. */
  supports(req: Request): boolean;

  /**
   * Authenticates the request. Returns `null` only when the strategy has
   * nothing to say (should not happen once `supports` returned `true`).
   * Invalid/expired credentials this strategy owns must throw instead.
   */
  authenticate(req: Request, res: Response): Promise<SessionUser | null>;

  /**
   * Optional, no-side-effect variant used by `OptionalSessionGuard`: must
   * never refresh tokens, mutate cookies, or resolve/cache a bucket — only
   * extract a `SessionUser` from whatever credential is already present, or
   * return `null`. Strategies with no side effects in `authenticate` (e.g.
   * header auth) can omit this; the guard falls back to `authenticate` and
   * swallows any exception it throws.
   */
  authenticateOptional?(req: Request): Promise<SessionUser | null>;
}
