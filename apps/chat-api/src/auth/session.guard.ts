import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../config/environment.config';
import { RefreshService } from './refresh.service';
import { SessionService } from './session.service';
import type { SessionPayload, SessionUser } from './session.types';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly session: SessionService,
    private readonly refresh: RefreshService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    let payload: SessionPayload;
    try {
      payload = await this.session.decryptFromRequest(req);
    } catch {
      throw new UnauthorizedException();
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.at_exp < now + 60) {
      payload = await this.refresh.refresh(payload);
      const newToken = await this.session.encrypt(payload);
      const cookieName = this.config.get('AUTH_SESSION_COOKIE_NAME', {
        infer: true,
      }) as string;
      res.cookie(cookieName, newToken, {
        ...COOKIE_OPTS,
        maxAge: (payload.rt_exp - now) * 1000,
      });
    }

    const user: SessionUser = {
      sid: payload.sid,
      sub: payload.sub,
      providerId: payload.providerId,
      claims: payload.claims,
      at: payload.at,
      csrf: payload.csrf,
    };
    req.user = user;
    return true;
  }
}
