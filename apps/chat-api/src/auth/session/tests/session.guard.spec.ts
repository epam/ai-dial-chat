import { randomUUID } from 'crypto';
import {
  ExecutionContext,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BucketService } from '../../bucket/bucket.service';
import { RefreshService } from '../../refresh/refresh.service';
import { SessionGuard } from '../session.guard';
import { SessionService } from '../session.service';
import type { SessionPayload } from '../session.types';

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

function makeContext(opts: { cookieValue?: string; isPublic?: boolean }): {
  context: ExecutionContext;
  req: Record<string, unknown>;
  res: {
    cookie: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
  };
} {
  const req: Record<string, unknown> = {
    cookies: opts.cookieValue ? { [COOKIE_NAME]: opts.cookieValue } : {},
    user: undefined,
  };
  const res = { cookie: vi.fn(), setHeader: vi.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, req, res };
}

describe('SessionGuard', () => {
  let guard: SessionGuard;
  let sessionService: {
    decryptFromRequest: ReturnType<typeof vi.fn>;
    encrypt: ReturnType<typeof vi.fn>;
  };
  let refreshService: { refresh: ReturnType<typeof vi.fn> };
  let bucketService: { getUserBucket: ReturnType<typeof vi.fn> };
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sessionService = {
      decryptFromRequest: vi.fn(),
      encrypt: vi.fn().mockResolvedValue('new-encrypted-token'),
    };
    refreshService = { refresh: vi.fn() };
    bucketService = { getUserBucket: vi.fn() };
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };

    const module = await Test.createTestingModule({
      providers: [
        SessionGuard,
        { provide: SessionService, useValue: sessionService },
        { provide: RefreshService, useValue: refreshService },
        { provide: BucketService, useValue: bucketService },
        { provide: Reflector, useValue: reflector },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'AUTH_SESSION_COOKIE_NAME' ? COOKIE_NAME : undefined,
          },
        },
      ],
    }).compile();

    guard = module.get(SessionGuard);
  });

  it('allows public routes without a cookie', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(sessionService.decryptFromRequest).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when cookie is missing', async () => {
    sessionService.decryptFromRequest.mockRejectedValue(
      new UnauthorizedException(),
    );
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when cookie is tampered', async () => {
    sessionService.decryptFromRequest.mockRejectedValue(
      new UnauthorizedException(),
    );
    const { context } = makeContext({ cookieValue: 'tampered.bad.token' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('passes through and sets request.user when at is not near-expired', async () => {
    const payload = makePayload(); // at_exp = now + 3600, well above threshold
    sessionService.decryptFromRequest.mockResolvedValue(payload);
    const { context, req } = makeContext({ cookieValue: 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ sub: 'user-1', sid: payload.sid });
    expect(refreshService.refresh).not.toHaveBeenCalled();
  });

  it('calls RefreshService and sets new cookie when at is near-expired', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ at_exp: now + 30 }); // 30s < threshold of 60s
    const refreshed = makePayload({ at_exp: now + 3600, rt_exp: now + 86400 });

    sessionService.decryptFromRequest.mockResolvedValue(payload);
    refreshService.refresh.mockResolvedValue(refreshed);

    const { context, res } = makeContext({ cookieValue: 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
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

    const { context, req, res } = makeContext({ cookieValue: 'valid-token' });
    await guard.canActivate(context);

    expect((req.user as { csrf: string }).csrf).toBe(payload.csrf);
    expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', payload.csrf);
  });

  describe('lazy bucket resolution', () => {
    it('fetches bucket and updates session cookie when payload.bucket is empty', async () => {
      const payload = makePayload({ bucket: '' });
      sessionService.decryptFromRequest.mockResolvedValue(payload);
      bucketService.getUserBucket.mockResolvedValue({
        bucket: 'resolved-bucket',
      });

      const { context, req, res } = makeContext({ cookieValue: 'valid-token' });
      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(bucketService.getUserBucket).toHaveBeenCalledWith('access-token');
      expect(sessionService.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: 'resolved-bucket' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        'new-encrypted-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect((req.user as { bucket: string }).bucket).toBe('resolved-bucket');
    });

    it('throws ServiceUnavailableException when bucket fetch fails', async () => {
      const payload = makePayload({ bucket: '' });
      sessionService.decryptFromRequest.mockResolvedValue(payload);
      bucketService.getUserBucket.mockRejectedValue(
        new Error('DIAL Core down'),
      );

      const { context } = makeContext({ cookieValue: 'valid-token' });
      await expect(guard.canActivate(context)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('skips bucket fetch when payload already has a bucket', async () => {
      const payload = makePayload({ bucket: 'existing-bucket' });
      sessionService.decryptFromRequest.mockResolvedValue(payload);

      const { context } = makeContext({ cookieValue: 'valid-token' });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(bucketService.getUserBucket).not.toHaveBeenCalled();
    });
  });
});
