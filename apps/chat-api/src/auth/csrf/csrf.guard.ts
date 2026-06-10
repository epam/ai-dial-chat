import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { SessionUser } from '../session/session.types';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    // Public routes (login, callback, logout, health, themes) skip CSRF.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    this.validateOrigin(req);
    this.validateToken(req);
    return true;
  }

  private validateOrigin(req: Request): void {
    const corsOrigin = this.config.get('CORS_ORIGIN', {
      infer: true,
    }) as string;
    const appOrigin = new URL(corsOrigin).origin;

    const originHeader = req.headers['origin'];
    const refererHeader = req.headers['referer'];

    // Express headers can be string | string[] — normalise to string
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const referer = Array.isArray(refererHeader)
      ? refererHeader[0]
      : refererHeader;

    const candidate = origin ?? (referer ? new URL(referer).origin : undefined);
    if (!candidate || candidate !== appOrigin) {
      throw new ForbiddenException('Origin check failed');
    }
  }

  private validateToken(req: Request): void {
    const user = req.user as SessionUser | undefined;
    if (!user) {
      throw new ForbiddenException('No session for CSRF check');
    }

    // Express headers can be string | string[] — normalise to string
    const raw = req.headers['x-csrf-token'];
    const headerToken = Array.isArray(raw) ? raw[0] : raw;
    if (!headerToken || headerToken !== user.csrf) {
      throw new ForbiddenException('Invalid CSRF token');
    }
  }
}
