import { randomUUID } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { SessionPayload } from '../session/session.types';
import { RefreshService } from './refresh.service';

function makePayload(overrides?: Partial<SessionPayload>): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    sid: randomUUID(),
    providerId: 'keycloak',
    sub: 'user-1',
    at: 'old-access-token',
    rt: 'old-refresh-token',
    at_exp: now + 30,
    rt_exp: now + 86400,
    iat: now - 3600,
    csrf: 'old-csrf',
    claims: { email: 'u@example.com' },
    ...overrides,
  };
}

describe('RefreshService', () => {
  let service: RefreshService;
  let mockClient: { refresh: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockClient = { refresh: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RefreshService,
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

    const result = await service.refresh(payload);

    expect(result.at).toBe('new-at');
    expect(result.at_exp).toBe(now + 3600);
    expect(result.rt).toBe('old-refresh-token'); // not rotated — unchanged
    expect(result.csrf).toBe(payload.csrf);
    expect(result.sid).toBe(payload.sid); // sid never changes on refresh
  });

  it('updates rt when provider rotates the refresh token', async () => {
    const payload = makePayload();
    const now = Math.floor(Date.now() / 1000);
    mockClient.refresh.mockResolvedValue({
      access_token: 'new-at',
      expires_at: now + 3600,
      refresh_token: 'new-rt',
    });

    const result = await service.refresh(payload);

    expect(result.rt).toBe('new-rt');
  });

  it('throws UnauthorizedException on invalid_grant', async () => {
    const payload = makePayload();
    mockClient.refresh.mockRejectedValue({ error: 'invalid_grant' });

    await expect(service.refresh(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException on other refresh errors', async () => {
    const payload = makePayload();
    mockClient.refresh.mockRejectedValue(new Error('network failure'));

    await expect(service.refresh(payload)).rejects.toThrow(
      UnauthorizedException,
    );
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
