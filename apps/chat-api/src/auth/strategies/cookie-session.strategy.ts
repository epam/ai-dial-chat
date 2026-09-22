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
  clearCookieValue,
  getCookieOptions,
  getSessionCookieName,
  readCookieValue,
  setCookieValue,
} from '../cookies/cookie-options';
import { RefreshService } from '../refresh/refresh.service';
import {
  getSessionCookieMaxAge,
  InvalidSessionException,
} from '../session/session-expiration';
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
    try {
      return await this.authenticateSession(req, res);
    } catch (err) {
      if (err instanceof InvalidSessionException) {
        clearCookieValue(
          res,
          getSessionCookieName(this.config),
          getCookieOptions(this.config),
          req.cookies as Record<string, string> | undefined,
        );
      }
      throw err;
    }
  }

  private async authenticateSession(
    req: Request,
    res: Response,
  ): Promise<SessionUser> {
    let payload: SessionPayload;
    try {
      payload = await this.session.decryptFromRequest(req);
    } catch {
      throw new InvalidSessionException('Invalid session');
    }
    const remainingLifetime = getSessionCookieMaxAge(payload);

    /*
     * Keep the CSRF token stable across access-token refreshes. Rotating it
     * together with the session cookie creates a race where another in-flight
     * request or browser tab sends the previous header with the new cookie.
     */
    const csrfForCurrentRequest = payload.csrf;

    let refreshRaceAbsorbed = false;
    const now = Math.floor(Date.now() / 1000);
    /* Renew before either the access token or the effective session deadline expires. */
    if (
      payload.rt &&
      (payload.at_exp < now + 60 || remainingLifetime < 60000)
    ) {
      try {
        const result = await this.refresh.refresh(payload);
        payload = result.payload;
        refreshRaceAbsorbed = !result.refreshed;
        if (result.refreshed) {
          const newToken = await this.session.encrypt(payload);
          const cookieName = getSessionCookieName(this.config);
          setCookieValue(
            res,
            cookieName,
            newToken,
            {
              ...getCookieOptions(this.config),
              maxAge: getSessionCookieMaxAge(payload),
            },
            req.cookies as Record<string, string> | undefined,
          );
          res.setHeader('X-CSRF-Token', payload.csrf);
        }
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
        if (!refreshRaceAbsorbed) {
          const newToken = await this.session.encrypt(payload);
          const cookieName = getSessionCookieName(this.config);
          setCookieValue(
            res,
            cookieName,
            newToken,
            {
              ...getCookieOptions(this.config),
              maxAge: getSessionCookieMaxAge(payload),
            },
            req.cookies as Record<string, string> | undefined,
          );
        }
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
        this.logger.error('Lazy bucket resolution failed', err);
        throw new ServiceUnavailableException(
          'Unable to resolve user bucket — DIAL Core unavailable',
        );
      }
    }

    getSessionCookieMaxAge(payload);
    if (
      refreshRaceAbsorbed &&
      payload.at_exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException(
        'Access token expired during refresh recovery',
      );
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
      getSessionCookieMaxAge(payload);
      if (payload.at_exp <= Math.floor(Date.now() / 1000)) return null;
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
