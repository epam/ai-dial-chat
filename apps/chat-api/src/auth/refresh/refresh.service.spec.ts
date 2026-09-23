import { randomUUID } from 'crypto';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { SessionExpiredDuringRefreshException } from '../session/session-expiration';
import { SessionPayload } from '../session/session.types';
import { RefreshService } from './refresh.service';

function makePayload(overrides?: Partial<SessionPayload>): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    v: 2,
    sid: randomUUID(),
    providerId: 'keycloak',
    sub: 'user-1',
    at: 'old-access-token',
    rt: 'old-refresh-token',
    at_exp: now + 30,
    session_exp: now + 86400,
    rt_exp: now + 86400,
    iat: now - 3600,
    csrf: 'old-csrf',
    claims: { email: 'u@example.com' },
    bucket: '',
    ...overrides,
  };
}

describe('RefreshService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  let service: RefreshService;
  let mockClient: { refresh: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockClient = { refresh: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RefreshService,
        { provide: ConfigService, useValue: { get: () => 2592000 } },
        {
          provide: ProviderRegistryService,
          useValue: {
            getProvider: vi.fn().mockReturnValue({ client: mockClient }),
          },
        },
      ],
    }).compile();

    service = module.get(RefreshService);
  });

  it('returns new SessionPayload with updated tokens on success', async () => {
    const payload = makePayload();
    const now = Math.floor(Date.now() / 1000);
    mockClient.refresh.mockResolvedValue({
      access_token: 'new-at',
      expires_at: now + 3600,
      refresh_token: undefined,
    });

    const { payload: result, refreshed } = await service.refresh(payload);
    expect(refreshed).toBe(true);

    expect(result.at).toBe('new-at');
    expect(result.at_exp).toBe(now + 3600);
    expect(result.rt).toBe('old-refresh-token'); // not rotated — unchanged
    expect(result.csrf).toBe(payload.csrf);
    expect(result.sid).toBe(payload.sid); // sid never changes on refresh
    expect(result.session_exp).toBe(now + 2592000);
    expect(result.rt_exp).toBe(payload.rt_exp);
  });

  it('updates rt when provider rotates the refresh token', async () => {
    const payload = makePayload();
    const now = Math.floor(Date.now() / 1000);
    mockClient.refresh.mockResolvedValue({
      access_token: 'new-at',
      expires_at: now + 3600,
      refresh_token: 'new-rt',
    });

    const { payload: result, refreshed } = await service.refresh(payload);
    expect(refreshed).toBe(true);

    expect(result.rt).toBe('new-rt');
    expect(result.rt_exp).toBeUndefined();
    expect(result.session_exp).toBe(now + 2592000);
  });

  it('renews the session independently of the Keycloak refresh deadline', async () => {
    const payload = makePayload();
    const now = Math.floor(Date.now() / 1000);
    mockClient.refresh.mockResolvedValue({
      access_token: 'new-at',
      expires_at: now + 300,
      refresh_token: 'new-rt',
      refresh_expires_in: 600,
    });
    const { payload: result, refreshed } = await service.refresh(payload);
    expect(refreshed).toBe(true);
    expect(result.rt_exp).toBe(now + 600);
    expect(result.session_exp).toBe(now + 2592000);
  });

  it('does not exchange an expired session or a missing refresh token', async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      service.refresh(makePayload({ session_exp: now })),
    ).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(makePayload({ rt: '' }))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockClient.refresh).not.toHaveBeenCalled();
  });

  it('allows an active session to renew beyond its original deadline', async () => {
    vi.useFakeTimers();
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ session_exp: now + 30, rt_exp: undefined });
    mockClient.refresh.mockImplementation(async () => ({
      access_token: 'renewed-at',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }));

    const first = await service.refresh(payload);
    vi.setSystemTime((now + 60) * 1000);
    const second = await service.refresh(first.payload);

    expect(second.payload.session_exp).toBe(now + 60 + 2592000);
    expect(second.payload.iat).toBe(now + 60);
    expect(second.payload.sid).toBe(payload.sid);
    expect(second.payload.csrf).toBe(payload.csrf);
    await expect(service.refresh(payload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockClient.refresh).toHaveBeenCalledTimes(2);
  });

  it('rejects a successful exchange that completes after the existing session deadline', async () => {
    vi.useFakeTimers();
    const now = Math.floor(Date.now() / 1000);
    mockClient.refresh.mockImplementation(async () => {
      vi.setSystemTime((now + 10) * 1000);
      return {
        access_token: 'new-at',
        expires_at: now + 3600,
        refresh_token: 'new-rt',
      };
    });
    await expect(
      service.refresh(makePayload({ session_exp: now + 5 })),
    ).rejects.toThrow(SessionExpiredDuringRefreshException);
  });

  it('throws UnauthorizedException on invalid_grant when the access token has already expired', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ at_exp: now - 10 });
    mockClient.refresh.mockRejectedValue({ error: 'invalid_grant' });

    await expect(service.refresh(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('absorbs invalid_grant as a lost refresh-token race when the access token is still valid', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = makePayload({ at_exp: now + 30 });
    mockClient.refresh.mockRejectedValue({ error: 'invalid_grant' });

    const result = await service.refresh(payload);

    expect(result).toEqual({ payload, refreshed: false });
  });

  it('throws UnauthorizedException on other refresh errors', async () => {
    const payload = makePayload();
    mockClient.refresh.mockRejectedValue(new Error('network failure'));

    await expect(service.refresh(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('logs an upstream failure without leaking provider error details or tokens', async () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const payload = makePayload();
    mockClient.refresh.mockRejectedValue(
      new Error(`provider response contains ${payload.rt}`),
    );

    await expect(service.refresh(payload)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(error).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: 'auth.refresh.failed',
        sessionId: payload.sid,
        providerId: payload.providerId,
        outcome: 'upstream_error',
      }),
    );
    const output = JSON.stringify(error.mock.calls);
    expect(output).not.toContain(payload.rt);
    expect(output).not.toContain(payload.at);
    expect(output).not.toContain('provider response contains');
  });

  it('coalesces concurrent calls for the same sid into a single upstream request', async () => {
    const payload = makePayload();
    const now = Math.floor(Date.now() / 1000);

    let resolveRefresh!: (value: unknown) => void;
    const upstreamPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    mockClient.refresh.mockReturnValue(upstreamPromise);

    const p1 = service.refresh(payload);
    const p2 = service.refresh({ ...payload }); // same sid → must join p1

    resolveRefresh({
      access_token: 'new-at',
      expires_at: now + 3600,
      refresh_token: undefined,
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(mockClient.refresh).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2); // same promise result
  });
});
