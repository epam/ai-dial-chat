import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderRegistryService } from '../../../auth/providers/provider-registry.service';
import { UserRolesService } from '../../../auth/user-roles.service';
import type { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { FeatureKey } from '../../feature-flags/feature-key.enum';
import { FeatureGuard } from '../../feature-flags/feature.guard';
import { RequireFeature } from '../../feature-flags/require-feature.decorator';

/* Every test session comes from `keycloak`, whose provider keeps the default
 * `roles` claim unless a test passes its own `rolesClaim`. */
const makeUserRoles = (rolesClaim?: string) =>
  new UserRolesService({
    getProvider: () => ({ client: {}, config: { rolesClaim } }),
  } as unknown as ProviderRegistryService);

function makeGuard(isEnabledResult: boolean, rolesClaim?: string) {
  const reflector = new Reflector();
  const featureFlagsService = {
    isEnabled: vi.fn(async () => isEnabledResult),
  } as unknown as FeatureFlagsService;
  return {
    guard: new FeatureGuard(
      reflector,
      featureFlagsService,
      makeUserRoles(rolesClaim),
    ),
    reflector,
    featureFlagsService,
  };
}

function makeContext(
  user?: { sub: string; claims: Record<string, unknown> },
  target: { handler?: object; controller?: object } = {},
) {
  const request = { user: user && { providerId: 'keycloak', ...user } };
  return {
    getHandler: vi.fn(() => target.handler ?? {}),
    switchToHttp: vi.fn(() => ({
      getRequest: vi.fn(() => request),
    })),
    getClass: vi.fn(() => target.controller),
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
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
      FeatureKey.AsrEnabled,
    );
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
        roles: ['admin', '42'],
      },
    );
  });

  it('throws ForbiddenException when feature is disabled', async () => {
    const { guard, reflector } = makeGuard(false);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
      FeatureKey.AsrEnabled,
    );
    const ctx = makeContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  describe('with real decorator metadata', () => {
    @RequireFeature(FeatureKey.ScheduledTasksEnabled)
    class ClassGatedController {
      list() {
        return [];
      }

      @RequireFeature(FeatureKey.AsrEnabled)
      transcribe() {
        return '';
      }
    }

    it('enforces a class-level RequireFeature on a handler without its own', async () => {
      const { guard, featureFlagsService } = makeGuard(false);
      const ctx = makeContext(undefined, {
        handler: ClassGatedController.prototype.list,
        controller: ClassGatedController,
      });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        FeatureKey.ScheduledTasksEnabled,
        expect.anything(),
      );
    });

    it('lets a handler-level RequireFeature override the class-level one', async () => {
      const { guard, featureFlagsService } = makeGuard(true);
      const ctx = makeContext(undefined, {
        handler: ClassGatedController.prototype.transcribe,
        controller: ClassGatedController,
      });

      expect(await guard.canActivate(ctx)).toBe(true);
      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
        FeatureKey.AsrEnabled,
        expect.anything(),
      );
      expect(featureFlagsService.isEnabled).not.toHaveBeenCalledWith(
        FeatureKey.ScheduledTasksEnabled,
        expect.anything(),
      );
    });
  });

  it('passes through when no RequireFeature metadata is set', async () => {
    const { guard, reflector } = makeGuard(false);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext();

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('allows an enabled alternative using the same caller context', async () => {
    const { guard, reflector, featureFlagsService } = makeGuard(false);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      FeatureKey.ScheduledTasksEnabled,
      FeatureKey.LiveChatInteraction,
    ]);
    vi.mocked(featureFlagsService.isEnabled)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    expect(
      await guard.canActivate(
        makeContext({ sub: 'user-1', claims: { roles: ['user'] } }),
      ),
    ).toBe(true);
    expect(featureFlagsService.isEnabled).toHaveBeenLastCalledWith(
      FeatureKey.LiveChatInteraction,
      { appId: 'chat-ui', userId: 'user-1', roles: ['user'] },
    );
  });

  describe('with a role-restricted feature', () => {
    /* Mirrors EnvConfigProvider: the feature is on only for role `R`. */
    const makeRoleGatedGuard = (rolesClaim: string) => {
      const { guard, reflector, featureFlagsService } = makeGuard(
        false,
        rolesClaim,
      );
      vi.mocked(featureFlagsService.isEnabled).mockImplementation(
        async (_key, context) => context.roles?.includes('R') ?? false,
      );
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
        FeatureKey.ScheduledTasksEnabled,
      );
      return guard;
    };

    it("allows a session holding the role under the provider's rolesClaim", async () => {
      const guard = makeRoleGatedGuard('dial_roles');

      expect(
        await guard.canActivate(
          makeContext({ sub: 'user-1', claims: { dial_roles: ['R'] } }),
        ),
      ).toBe(true);
    });

    it('denies the same session without the role', async () => {
      const guard = makeRoleGatedGuard('dial_roles');

      await expect(
        guard.canActivate(
          makeContext({
            sub: 'user-1',
            claims: { dial_roles: ['other'], roles: ['R'] },
          }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a header-token session holding a nested dotted claim', async () => {
      const guard = makeRoleGatedGuard('realm_access.roles');

      expect(
        await guard.canActivate(
          makeContext({
            sub: 'user-1',
            claims: { realm_access: { roles: ['R'] } },
          }),
        ),
      ).toBe(true);
    });
  });

  it('evaluates a request without a session with no user id or roles', async () => {
    const { guard, reflector, featureFlagsService } = makeGuard(true);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(
      FeatureKey.AsrEnabled,
    );

    await guard.canActivate(makeContext());

    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(
      FeatureKey.AsrEnabled,
      { appId: 'chat-ui', userId: undefined, roles: undefined },
    );
  });

  it('denies when all alternative features are disabled', async () => {
    const { guard, reflector } = makeGuard(false);
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      FeatureKey.ScheduledTasksEnabled,
      FeatureKey.LiveChatInteraction,
    ]);
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      ForbiddenException,
    );
  });
});
