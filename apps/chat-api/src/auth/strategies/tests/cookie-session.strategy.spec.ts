import { randomUUID } from 'crypto';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BucketService } from '../../bucket/bucket.service';
import { RefreshService } from '../../refresh/refresh.service';
import { SessionService } from '../../session/session.service';
import type { SessionPayload } from '../../session/session.types';
import { CookieSessionStrategy } from '../cookie-session.strategy';

const COOKIE_NAME = '__Host-chat.sess';

function makePayload(overrides?: Partial<SessionPayload>): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    sid: randomUUID(),
    providerId: 'keycloak',
    sub: 'user-1',
    at: 'access-token',
    rt: 'refresh-token',
    at_exp: now + 3600,
    rt_exp: now + 86400,
    iat: now,
    csrf: randomUUID(),
    claims: {},
    bucket: 'user-bucket',
    ...overrides,
  };
}

function makeReqRes(cookieValue?: string): {
  req: Request;
  res: {
    cookie: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
} {
  const req = {
    cookies: cookieValue ? { [COOKIE_NAME]: cookieValue } : {},
    user: undefined,
  } as unknown as Request;
  const res = { cookie: vi.fn(), setHeader: vi.fn() };
  return { req, res: res as unknown as typeof res };
}

describe('CookieSessionStrategy', () => {
  let strategy: CookieSessionStrategy;
  let sessionService: {
    decryptFromRequest: ReturnType<typeof vi.fn>;
    encrypt: ReturnType<typeof vi.fn>;
  };
  let refreshService: { refresh: ReturnType<typeof vi.fn> };
  let bucketService: { getUserBucket: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sessionService = {
      decryptFromRequest: vi.fn(),
      encrypt: vi.fn().mockResolvedValue('new-encrypted-token'),
    };
    refreshService = { refresh: vi.fn() };
    bucketService = { getUserBucket: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CookieSessionStrategy,
        { provide: SessionService, useValue: sessionService },
        { provide: RefreshService, useValue: refreshService },
        { provide: BucketService, useValue: bucketService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'AUTH_SESSION_COOKIE_NAME' ? COOKIE_NAME : undefined,
          },
        },
      ],
    }).compile();

    strategy = module.get(CookieSessionStrategy);
  });

  it('supports() is false when no session cookie is present', () => {
    const { req } = makeReqRes();
    expect(strategy.supports(req)).toBe(false);
  });

  it('supports() is true when a session cookie is present', () => {
    const { req } = makeReqRes('valid-token');
    expect(strategy.supports(req)).toBe(true);
  });

  it('throws UnauthorizedException when cookie is missing', async () => {
    sessionService.decryptFromRequest.mockRejectedValue(
      new UnauthorizedException(),
    );
    const { req, res } = makeReqRes();
    await expect(
      strategy.authenticate(req, res as unknown as Response),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when cookie is tampered', async () => {
    sessionService.decryptFromRequest.mockRejectedValue(
      new UnauthorizedException(),
    );
    const { req, res } = makeReqRes('tampered.bad.token');
    await expect(
      strategy.authenticate(req, res as unknown as Response),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns a SessionUser when at is not near-expired', async () => {
    const payload = makePayload(); // at_exp = now + 3600, well above threshold
    sessionService.decryptFromRequest.mockResolvedValue(payload);
    const { req, res } = makeReqRes('valid-token');

    const user = await strategy.authenticate(req, res as unknown as Response);
    expect(user).toMatchObject({ sub: 'user-1', sid: payload.sid });
    expect(refreshService.refresh).not.toHaveBeenCalled();
  });

  it('calls RefreshService and sets new cookie when at is near-expired', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ at_exp: now + 30 }); // 30s < threshold of 60s
    const refreshed = makePayload({ at_exp: now + 3600, rt_exp: now + 86400 });

    sessionService.decryptFromRequest.mockResolvedValue(payload);
    refreshService.refresh.mockResolvedValue(refreshed);

    const { req, res } = makeReqRes('valid-token');

    await strategy.authenticate(req, res as unknown as Response);
    expect(refreshService.refresh).toHaveBeenCalledWith(payload);
    expect(sessionService.encrypt).toHaveBeenCalledWith(refreshed);
    expect(res.cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      'new-encrypted-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      }),
    );
  });

  it('rethrows a genuine UnauthorizedException from RefreshService as-is', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ at_exp: now + 30 });
    sessionService.decryptFromRequest.mockResolvedValue(payload);
    refreshService.refresh.mockRejectedValue(
      new UnauthorizedException('Refresh token expired or revoked'),
    );

    const { req, res } = makeReqRes('valid-token');
    await expect(
      strategy.authenticate(req, res as unknown as Response),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('converts an unexpected error from RefreshService into a clean UnauthorizedException', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ at_exp: now + 30 });
    sessionService.decryptFromRequest.mockResolvedValue(payload);
    refreshService.refresh.mockRejectedValue(
      new Error('unexpected provider registry failure'),
    );

    const { req, res } = makeReqRes('valid-token');
    await expect(
      strategy.authenticate(req, res as unknown as Response),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('keeps the CSRF token stable when refreshing the session', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ at_exp: now + 30 });
    const refreshed = makePayload({
      at_exp: now + 3600,
      rt_exp: now + 86400,
      csrf: payload.csrf,
    });

    sessionService.decryptFromRequest.mockResolvedValue(payload);
    refreshService.refresh.mockResolvedValue(refreshed);

    const { req, res } = makeReqRes('valid-token');
    const user = await strategy.authenticate(req, res as unknown as Response);

    expect(user.csrf).toBe(payload.csrf);
    expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', payload.csrf);
  });

  describe('cross-pod refresh-token race (issue #8150)', () => {
    /*
     * RefreshService's in-flight mutex is per-instance, mirroring how it's
     * per-pod in production (no shared store). Two separate instances here
     * simulate two pods receiving near-simultaneous requests for the same
     * sid, neither aware of the other's in-flight refresh.
     */
    const makeStrategyWithRealRefreshService = (mockClient: {
      refresh: ReturnType<typeof vi.fn>;
    }) => {
      const realRefreshService = new RefreshService({
        getProvider: vi.fn().mockReturnValue({ client: mockClient }),
      } as never);
      const strategySessionService = {
        decryptFromRequest: vi.fn(),
        encrypt: vi.fn().mockResolvedValue('new-encrypted-token'),
      };
      const strategyBucketService = { getUserBucket: vi.fn() };
      const strategyInstance = new CookieSessionStrategy(
        strategySessionService as never,
        realRefreshService,
        strategyBucketService as never,
        {
          get: (key: string) =>
            key === 'AUTH_SESSION_COOKIE_NAME' ? COOKIE_NAME : undefined,
        } as never,
      );
      return { strategyInstance, strategySessionService };
    };

    it('authorizes the losing pod instead of 401ing it, when the access token is still valid', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = makePayload({ at_exp: now + 30, bucket: 'user-bucket' });

      // Pod A: refresh succeeds and rotates the refresh token.
      const podAClient = {
        refresh: vi.fn().mockResolvedValue({
          access_token: 'new-at',
          expires_at: now + 3600,
          refresh_token: 'rotated-rt',
        }),
      };
      const { strategyInstance: strategyA, strategySessionService: sessionA } =
        makeStrategyWithRealRefreshService(podAClient);
      sessionA.decryptFromRequest.mockResolvedValue(payload);
      const { req: reqA, res: resA } = makeReqRes('cookie-v0');

      await expect(
        strategyA.authenticate(reqA, resA as unknown as Response),
      ).resolves.toMatchObject({ sub: payload.sub, sid: payload.sid });

      // Pod B: same stale payload/cookie, but the IdP has already consumed
      // this refresh token via Pod A — it rejects with invalid_grant.
      const podBClient = {
        refresh: vi.fn().mockRejectedValue({ error: 'invalid_grant' }),
      };
      const { strategyInstance: strategyB, strategySessionService: sessionB } =
        makeStrategyWithRealRefreshService(podBClient);
      sessionB.decryptFromRequest.mockResolvedValue(payload);
      const { req: reqB, res: resB } = makeReqRes('cookie-v0');

      await expect(
        strategyB.authenticate(reqB, resB as unknown as Response),
      ).resolves.toMatchObject({ sub: payload.sub, sid: payload.sid });
    });

    it('still 401s the losing pod when the access token has already expired', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = makePayload({ at_exp: now - 5, bucket: 'user-bucket' });

      const podBClient = {
        refresh: vi.fn().mockRejectedValue({ error: 'invalid_grant' }),
      };
      const { strategyInstance: strategyB, strategySessionService: sessionB } =
        makeStrategyWithRealRefreshService(podBClient);
      sessionB.decryptFromRequest.mockResolvedValue(payload);
      const { req: reqB, res: resB } = makeReqRes('cookie-v0');

      await expect(
        strategyB.authenticate(reqB, resB as unknown as Response),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('lazy bucket resolution', () => {
    it('fetches bucket and updates session cookie when payload.bucket is empty', async () => {
      const payload = makePayload({ bucket: '' });
      sessionService.decryptFromRequest.mockResolvedValue(payload);
      bucketService.getUserBucket.mockResolvedValue({
        bucket: 'resolved-bucket',
      });

      const { req, res } = makeReqRes('valid-token');
      const user = await strategy.authenticate(req, res as unknown as Response);

      expect(bucketService.getUserBucket).toHaveBeenCalledWith('access-token');
      expect(sessionService.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: 'resolved-bucket' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        'new-encrypted-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(user.bucket).toBe('resolved-bucket');
    });

    it('throws ServiceUnavailableException when bucket fetch fails', async () => {
      const payload = makePayload({ bucket: '' });
      sessionService.decryptFromRequest.mockResolvedValue(payload);
      bucketService.getUserBucket.mockRejectedValue(
        new Error('DIAL Core down'),
      );

      const { req, res } = makeReqRes('valid-token');
      await expect(
        strategy.authenticate(req, res as unknown as Response),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('skips bucket fetch when payload already has a bucket', async () => {
      const payload = makePayload({ bucket: 'existing-bucket' });
      sessionService.decryptFromRequest.mockResolvedValue(payload);

      const { req, res } = makeReqRes('valid-token');
      await strategy.authenticate(req, res as unknown as Response);
      expect(bucketService.getUserBucket).not.toHaveBeenCalled();
    });
  });

  describe('authenticateOptional() — used by OptionalSessionGuard', () => {
    it('returns null instead of throwing when the cookie is missing or tampered', async () => {
      sessionService.decryptFromRequest.mockRejectedValue(
        new UnauthorizedException(),
      );
      const { req } = makeReqRes('tampered.bad.token');
      await expect(strategy.authenticateOptional(req)).resolves.toBeNull();
    });

    it('never triggers a refresh even when at_exp is near expiry', async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = makePayload({ at_exp: now + 30 });
      sessionService.decryptFromRequest.mockResolvedValue(payload);

      const { req } = makeReqRes('valid-token');
      const user = await strategy.authenticateOptional(req);

      expect(refreshService.refresh).not.toHaveBeenCalled();
      expect(user).toMatchObject({ sub: payload.sub, sid: payload.sid });
    });

    it('never resolves the bucket even when payload.bucket is empty', async () => {
      const payload = makePayload({ bucket: '' });
      sessionService.decryptFromRequest.mockResolvedValue(payload);

      const { req } = makeReqRes('valid-token');
      const user = await strategy.authenticateOptional(req);

      expect(bucketService.getUserBucket).not.toHaveBeenCalled();
      expect(user?.bucket).toBe('');
    });
  });
});
