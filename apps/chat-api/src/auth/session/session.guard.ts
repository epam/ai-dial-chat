import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { EnvironmentVariables } from '../../config/environment.config';
import { BucketService } from '../bucket/bucket.service';
import {
  getCookieOptions,
  getSessionCookieName,
  setCookieValue,
} from '../cookies/cookie-options';
import { RefreshService } from '../refresh/refresh.service';
import { SessionService } from './session.service';
import type { SessionPayload, SessionUser } from './session.types';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(
    private readonly session: SessionService,
    private readonly refresh: RefreshService,
    private readonly bucket: BucketService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
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

    let payload: SessionPayload;
    try {
      payload = await this.session.decryptFromRequest(req);
    } catch {
      throw new UnauthorizedException();
    }

    // Keep the CSRF token stable across access-token refreshes. Rotating it
    // together with the session cookie creates a race where another in-flight
    // request or browser tab sends the previous header with the new cookie.
    const csrfForCurrentRequest = payload.csrf;

    const now = Math.floor(Date.now() / 1000);
    if (payload.at_exp < now + 60) {
      const refreshedPayload = await this.refresh.refresh(payload);
      payload = { ...refreshedPayload, csrf: csrfForCurrentRequest };
      const newToken = await this.session.encrypt(payload);
      const cookieName = getSessionCookieName(this.config);
      setCookieValue(
        res,
        cookieName,
        newToken,
        {
          ...getCookieOptions(this.config),
          maxAge: (payload.rt_exp - now) * 1000,
        },
        req.cookies as Record<string, string> | undefined,
      );
      res.setHeader('X-CSRF-Token', payload.csrf);
    }

    if (!payload.bucket) {
      try {
        const { bucket } = await this.bucket.getUserBucket(payload.at);
        payload = { ...payload, bucket };
        const newToken = await this.session.encrypt(payload);
        const cookieName = getSessionCookieName(this.config);
        setCookieValue(
          res,
          cookieName,
          newToken,
          {
            ...getCookieOptions(this.config),
            maxAge: (payload.rt_exp - Math.floor(Date.now() / 1000)) * 1000,
          },
          req.cookies as Record<string, string> | undefined,
        );
      } catch (err) {
        this.logger.error('Lazy bucket resolution failed', err);
        throw new ServiceUnavailableException(
          'Unable to resolve user bucket — DIAL Core unavailable',
        );
      }
    }

    const user: SessionUser = {
      sid: payload.sid,
      sub: payload.sub,
      providerId: payload.providerId,
      claims: payload.claims,
      at: payload.at,
      csrf: csrfForCurrentRequest,
      bucket: payload.bucket,
    };
    req.user = user;
    return true;
  }
}
