import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_STRATEGIES } from '../strategies/auth-strategies.token';
import type { AuthStrategy } from '../strategies/auth-strategy.interface';

/**
 * Populates `req.user`/`req.authSource` when a supported, valid credential is
 * present, but never throws. Use on public endpoints that should enrich
 * context (e.g. role-based feature flags) when the caller happens to be
 * authenticated, without requiring authentication.
 *
 * Uses each strategy's `authenticateOptional` when available (no side
 * effects — no refresh, no bucket resolution, no cookie mutation); falls
 * back to `authenticate` (swallowing any exception) for strategies with no
 * side effects to avoid, such as header auth.
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(
    @Inject(AUTH_STRATEGIES) private readonly strategies: AuthStrategy[],
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    for (const strategy of this.strategies) {
      if (!strategy.supports(req)) {
        continue;
      }

      const user = await this.tryAuthenticate(strategy, req);
      if (user) {
        req.user = user;
        req.authSource = strategy.source;
        return true;
      }
    }

    return true;
  }

  private async tryAuthenticate(strategy: AuthStrategy, req: Request) {
    try {
      if (strategy.authenticateOptional) {
        return await strategy.authenticateOptional(req);
      }
      return await strategy.authenticate(req, undefined as never);
    } catch {
      return null;
    }
  }
}
