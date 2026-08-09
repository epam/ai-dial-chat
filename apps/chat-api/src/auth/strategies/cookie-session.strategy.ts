import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../../config/environment.config';
import { AuthSource } from '../auth-source.enum';
import { BucketService } from '../bucket/bucket.service';
import {
  getCookieOptions,
  getSessionCookieName,
  readCookieValue,
  setCookieValue,
} from '../cookies/cookie-options';
import { RefreshService } from '../refresh/refresh.service';
import { SessionService } from '../session/session.service';
import type { SessionPayload, SessionUser } from '../session/session.types';
import type { AuthStrategy } from './auth-strategy.interface';

@Injectable()
export class CookieSessionStrategy implements AuthStrategy {
  readonly source = AuthSource.Cookie;

  private readonly logger = new Logger(CookieSessionStrategy.name);

  constructor(
    private readonly session: SessionService,
    private readonly refresh: RefreshService,
    private readonly bucket: BucketService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  supports(req: Request): boolean {
    const cookieName = getSessionCookieName(this.config);
    return Boolean(
      readCookieValue(
        req.cookies as Record<string, string> | undefined,
        cookieName,
      ),
    );
  }

  async authenticate(req: Request, res: Response): Promise<SessionUser> {
    let payload: SessionPayload;
    try {
      payload = await this.session.decryptFromRequest(req);
    } catch {
      throw new UnauthorizedException();
    }

    /*
     * Keep the CSRF token stable across access-token refreshes. Rotating it
     * together with the session cookie creates a race where another in-flight
     * request or browser tab sends the previous header with the new cookie.
     */
    const csrfForCurrentRequest = payload.csrf;

    const now = Math.floor(Date.now() / 1000);
    if (payload.at_exp < now + 60) {
      try {
        payload = await this.refresh.refresh(payload);
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
      } catch (err) {
        if (err instanceof UnauthorizedException) {
          throw err;
        }
        this.logger.error('Unexpected error during token refresh', err);
        throw new UnauthorizedException();
      }
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

    return {
      sid: payload.sid,
      sub: payload.sub,
      providerId: payload.providerId,
      claims: payload.claims,
      at: payload.at,
      csrf: csrfForCurrentRequest,
      bucket: payload.bucket,
    };
  }

  /**
   * No-side-effect variant for `OptionalSessionGuard`: decrypts the cookie
   * if present but never refreshes an expiring access token, never resolves
   * the bucket, and never mutates the response — an expired access token is
   * treated as "no session" rather than triggering a refresh. Token refresh
   * stays exclusive to `authenticate()` on protected routes.
   */
  async authenticateOptional(req: Request): Promise<SessionUser | null> {
    let payload: SessionPayload;
    try {
      payload = await this.session.decryptFromRequest(req);
    } catch {
      return null;
    }

    return {
      sid: payload.sid,
      sub: payload.sub,
      providerId: payload.providerId,
      claims: payload.claims,
      at: payload.at,
      csrf: payload.csrf,
      bucket: payload.bucket,
    };
  }
}
