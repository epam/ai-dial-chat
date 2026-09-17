import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import {
  AUTH_OUTCOME_ATTRIBUTE,
  AUTH_REASON_ATTRIBUTE,
  AUTH_SOURCE_ATTRIBUTE,
  AuthAuthorizationOutcome,
  AuthAuthorizationReason,
  type AuthAuthorizationSource,
  NO_AUTH_SOURCE,
  authAuthorization,
  classifyAuthorizationFailure,
} from '../auth-metrics';
import { AUTH_STRATEGIES } from '../strategies/auth-strategies.token';
import type { AuthStrategy } from '../strategies/auth-strategy.interface';
import { AuthErrorCode } from './auth-error-code.enum';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AUTH_STRATEGIES) private readonly strategies: AuthStrategy[],
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    for (const strategy of this.strategies) {
      if (!strategy.supports(req)) {
        continue;
      }
      let user;
      try {
        user = await strategy.authenticate(req, res);
      } catch (err) {
        /*
         * A supported strategy that throws is a final decision — the guard must not fall
         * through to the next one (see `AuthStrategy`), so the rejection is attributed to
         * this strategy's own credential source before the exception propagates.
         */
        this.recordDecision(
          strategy.source,
          AuthAuthorizationOutcome.Rejected,
          classifyAuthorizationFailure(err),
        );
        throw err;
      }
      if (user) {
        req.user = user;
        req.authSource = strategy.source;
        this.recordDecision(
          strategy.source,
          AuthAuthorizationOutcome.Accepted,
          AuthAuthorizationReason.Accepted,
        );
        return true;
      }
    }

    /*
     * No strategy claimed the request — or one returned no principal without throwing,
     * which `AuthStrategy` documents as not expected. Either way no credential source
     * owns this decision, so it is recorded under `none`.
     */
    this.recordDecision(
      NO_AUTH_SOURCE,
      AuthAuthorizationOutcome.Rejected,
      AuthAuthorizationReason.NoCredentials,
    );

    throw new UnauthorizedException({
      code: AuthErrorCode.NoCredentials,
      error: 'Unauthorized',
      message: 'No valid credentials supplied',
      statusCode: 401,
    });
  }

  /*
   * One counted decision per guarded request. Public routes short-circuit above and are
   * deliberately not counted: they make no authorization decision, and counting them
   * would turn this into a request counter that the HTTP metrics already provide.
   */
  private recordDecision(
    source: AuthAuthorizationSource,
    outcome: AuthAuthorizationOutcome,
    reason: AuthAuthorizationReason,
  ): void {
    authAuthorization.add(1, {
      [AUTH_SOURCE_ATTRIBUTE]: source,
      [AUTH_OUTCOME_ATTRIBUTE]: outcome,
      [AUTH_REASON_ATTRIBUTE]: reason,
    });
  }
}
