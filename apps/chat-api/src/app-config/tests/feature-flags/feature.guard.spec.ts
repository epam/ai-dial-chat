import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { FeatureKey } from '../../feature-flags/feature-key.enum';
import { FeatureGuard } from '../../feature-flags/feature.guard';

function makeGuard(isEnabledResult: boolean) {
  const reflector = new Reflector();
  const featureFlagsService = {
    isEnabled: vi.fn(async () => isEnabledResult),
  } as unknown as FeatureFlagsService;
  return {
    guard: new FeatureGuard(reflector, featureFlagsService),
    reflector,
    featureFlagsService,
  };
}

function makeContext(user?: { sub: string; claims: Record<string, unknown> }) {
  const request = { user };
  return {
    getHandler: vi.fn(() => ({})),
    switchToHttp: vi.fn(() => ({
      getRequest: vi.fn(() => request),
    })),
    getClass: vi.fn(),
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
    getType: vi.fn(),
  } as unknown as import('@nestjs/common').ExecutionContext;
}

describe('FeatureGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows when feature is enabled', async () => {
    const { guard, reflector, featureFlagsService } = makeGuard(true);
    vi.spyOn(reflector, 'get').mockReturnValue(FeatureKey.AsrEnabled);
    const ctx = makeContext({
      sub: 'user-1',
      claims: { roles: ['admin', 42] },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
      FeatureKey.AsrEnabled,
      {
        appId: 'chat-ui',
        userId: 'user-1',
        roles: ['admin'],
      },
    );
  });

  it('throws ForbiddenException when feature is disabled', async () => {
    const { guard, reflector } = makeGuard(false);
    vi.spyOn(reflector, 'get').mockReturnValue(FeatureKey.AsrEnabled);
    const ctx = makeContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('passes through when no RequireFeature metadata is set', async () => {
    const { guard, reflector } = makeGuard(false);
    vi.spyOn(reflector, 'get').mockReturnValue(undefined);
    const ctx = makeContext();

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
