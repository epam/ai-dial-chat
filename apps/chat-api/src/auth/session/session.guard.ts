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
      const user = await strategy.authenticate(req, res);
      if (user) {
        req.user = user;
        req.authSource = strategy.source;
        return true;
      }
    }

    throw new UnauthorizedException({
      code: AuthErrorCode.NoCredentials,
      error: 'Unauthorized',
      message: 'No valid credentials supplied',
      statusCode: 401,
    });
  }
}
