import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from './session.service';
import type { SessionUser } from './session.types';

/**
 * Populates `req.user` when a valid session cookie is present, but never throws.
 * Use on public endpoints that should enrich context (e.g. role-based feature flags)
 * when the caller happens to be authenticated, without requiring authentication.
 *
 * Does NOT perform token refresh — if the access token is expired the session is
 * treated as absent. Token refresh is handled by SessionGuard on protected routes.
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly session: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    try {
      const payload = await this.session.decryptFromRequest(req);
      const user: SessionUser = {
        sid: payload.sid,
        sub: payload.sub,
        providerId: payload.providerId,
        claims: payload.claims,
        at: payload.at,
        csrf: payload.csrf,
        bucket: payload.bucket,
      };
      req.user = user;
    } catch {
      // No session or invalid/expired session — continue without user context
    }
    return true;
  }
}
