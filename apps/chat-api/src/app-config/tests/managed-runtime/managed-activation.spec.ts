import { ForbiddenException, Logger } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRolesService } from '../../../auth/user-roles.service';
import type { AppConfigEvalContext } from '../../app-config.types';
import type { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { FeatureKey } from '../../feature-flags/feature-key.enum';
import { FeatureGuard } from '../../feature-flags/feature.guard';
import { RuntimeReadKind } from '../../managed-runtime/snapshot-reader';
import {
  buildManagedStack,
  destroyManagedStacks,
  publishedRevision,
} from './managed-stack.fixtures';

/* The real schema manages no feature, and none of the welcome-text or
 * usage-limit keys these tests use, so they run on the test-only contract
 * (see test-managed-contract.fixtures.ts). The real announcement and
 * celebration keys are covered by managed-content-activation.spec.ts. */
vi.mock(
  '../../config-registry/config-registry.constants',
  async (importOriginal) =>
    (
      await import('../managed-config/test-managed-contract.fixtures')
    ).withTestManagedRegistry(await importOriginal()),
);
vi.mock('../../managed-runtime/snapshot-acceptance', async (importOriginal) =>
  (
    await import('../managed-config/test-managed-contract.fixtures')
  ).withTestManagedValidators(
    await importOriginal(),
    (await import('../../config-registry/config-registry.constants'))
      .CONFIG_DEFINITIONS,
  ),
);

const ACTIVE = {
  MANAGED_CONFIG_MODE: 'active',
  MANAGED_CONFIG_INSTANCES: 'ai-dial-chat=chat-dev',
  MANAGED_CONFIG_API_KEY: 'reader-key',
  MANAGED_CONFIG_MAX_STALENESS_SECONDS: '900',
};
const FEATURE = 'features.usageLimitsControl';
const INTERVAL = 60_000;

const anonymous: AppConfigEvalContext = { appId: 'ai-dial-chat' };
const beta: AppConfigEvalContext = {
  appId: 'ai-dial-chat',
  userId: 'u-beta',
  roles: ['beta', 'staff'],
};
const staff: AppConfigEvalContext = {
  appId: 'ai-dial-chat',
  userId: 'u-staff',
  roles: ['staff'],
};

const published = publishedRevision;

const iso = (epochMs: number) => new Date(epochMs).toISOString();

const buildStack = buildManagedStack;

const activeKeys = (...keys: string[]) => ({
  ...ACTIVE,
  MANAGED_CONFIG_ACTIVE_KEYS: keys.join(','),
});

const featureStack = (
  state: Record<string, unknown> | undefined,
  raw: Record<string, unknown> = {},
) =>
  buildStack({ ...activeKeys(FEATURE), ...raw }, (fake) =>
    fake.respondAlways(
      'chat-dev',
      published('r1', {
        config: {},
        features: state ? { [FEATURE]: state } : {},
      }),
    ),
  );

describe('managed configuration activation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });
  afterEach(() => {
    destroyManagedStacks();
    vi.restoreAllMocks();
  });

  describe('config values', () => {
    const welcomeStack = (raw: Record<string, unknown> = {}) =>
      buildStack(
        { ...activeKeys('welcomeScreen.description'), ...raw },
        (fake) =>
          fake.respondAlways(
            'chat-dev',
            published('r1', {
              config: {
                'welcomeScreen.description': 'Welcome',
                'usageLimits.warningThresholdPercent': 80,
              },
              features: {},
            }),
          ),
      );

    it('applies the managed value when the environment is silent', async () => {
      const { service } = await welcomeStack();
      const response = await service.getClientConfig(anonymous);
      expect(response.config.welcomeScreenDescription).toBe('Welcome');
    });

    it('keeps an explicit environment value', async () => {
      const { service } = await welcomeStack({
        WELCOME_SCREEN_DESCRIPTION: 'Local',
      });
      const response = await service.getClientConfig(anonymous);
      expect(response.config.welcomeScreenDescription).toBe('Local');
    });

    it('leaves an unlisted managed key on its environment value', async () => {
      const { service } = await welcomeStack();
      const response = await service.getClientConfig(anonymous);
      expect(response.config.usageLimitsWarningThresholdPercent).toBe(75);
    });

    it('uses the default for a key the publication omits', async () => {
      const { service } = await buildStack(
        activeKeys('welcomeScreen.description'),
        (fake) =>
          fake.respondAlways(
            'chat-dev',
            published('r1', { config: {}, features: {} }),
          ),
      );
      const response = await service.getClientConfig(anonymous);
      expect(response.config.welcomeScreenDescription).toBeNull();
    });

    it('normalizes a managed value like an environment value', async () => {
      const markup = '<script>alert(1)</script><b>x</b>';
      const managed = await buildStack(
        activeKeys('announcement.description'),
        (fake) =>
          fake.respondAlways(
            'chat-dev',
            published('r1', {
              config: { 'announcement.description': markup },
              features: {},
            }),
          ),
      );
      const fromEnvironment = await buildStack(
        { ANNOUNCEMENT_DESCRIPTION: markup },
        () => undefined,
      );
      const managedResponse = await managed.service.getClientConfig(anonymous);
      const environmentResponse =
        await fromEnvironment.service.getClientConfig(anonymous);
      expect(managedResponse.config.announcementDescription).toBe(
        environmentResponse.config.announcementDescription,
      );
      expect(managedResponse.config.announcementDescription).not.toContain(
        'script',
      );
    });

    it('falls back to the default and reports a stale snapshot', async () => {
      const { service, clock } = await buildStack(
        activeKeys('onboarding.hints'),
        (fake) => {
          fake.respond(
            'chat-dev',
            published('r1', {
              config: {
                'onboarding.hints': [
                  { id: 'tour.start', target: 'new-chat', title: 'Start' },
                ],
              },
              features: {},
            }),
          );
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable });
        },
      );
      expect(
        (await service.getClientConfig(anonymous)).config.onboardingHints,
      ).toEqual([
        {
          id: 'tour.start',
          target: 'new-chat',
          title: 'Start',
          description: null,
          pages: [],
        },
      ]);

      await clock.advance(900_001);
      const response = await service.getClientConfig(anonymous);
      expect(response.config.onboardingHints).toEqual([]);
      expect(response.metadata?.managed).toEqual({
        instanceId: 'chat-dev',
        state: 'stale',
      });
    });
  });

  describe('response cache', () => {
    it('misses the cache once a new revision is accepted', async () => {
      const { service, clock } = await buildStack(
        activeKeys('welcomeScreen.description'),
        (fake) => {
          fake.respond(
            'chat-dev',
            published('r1', {
              config: { 'welcomeScreen.description': 'First' },
              features: {},
            }),
          );
          fake.respondAlways(
            'chat-dev',
            published('r2', {
              config: { 'welcomeScreen.description': 'Second' },
              features: {},
            }),
          );
        },
      );
      expect(
        (await service.getClientConfig(anonymous)).config
          .welcomeScreenDescription,
      ).toBe('First');

      await clock.advance(INTERVAL);
      expect(
        (await service.getClientConfig(anonymous)).config
          .welcomeScreenDescription,
      ).toBe('Second');
    });

    it('never caches past the next window boundary', async () => {
      let startsAt = 0;
      const { service, clock, cacheTtls } = await buildStack(
        activeKeys(FEATURE),
        (fake, fakeClock) => {
          startsAt = fakeClock.now() + 20_000;
          fake.respondAlways(
            'chat-dev',
            published('r1', {
              config: {},
              features: {
                [FEATURE]: {
                  enabled: true,
                  availability: { startsAt: iso(startsAt) },
                },
              },
            }),
          );
        },
      );

      const before = await service.getClientConfig(anonymous);
      expect(before.features['usageLimitsControl']).toBe(false);
      expect(cacheTtls.at(-1)).toBe(20_000);
      expect(before.metadata?.nextRefreshAt).toBe(iso(startsAt));

      await clock.advance(20_000);
      const after = await service.getClientConfig(anonymous);
      expect(after.features['usageLimitsControl']).toBe(true);
    });

    it('never caches longer than the browser refresh interval', async () => {
      const { service, cacheTtls } = await buildStack(
        {
          ...activeKeys('welcomeScreen.description'),
          MANAGED_CONFIG_CLIENT_REFRESH_SECONDS: '30',
        },
        (fake) =>
          fake.respondAlways(
            'chat-dev',
            published('r1', { config: {}, features: {} }),
          ),
      );
      const response = await service.getClientConfig(anonymous);
      expect(cacheTtls.at(-1)).toBe(30_000);
      expect(response.metadata?.cacheTtlSeconds).toBe(30);
    });

    it('never caches past staleness expiry', async () => {
      const { service, clock, cacheTtls } = await buildStack(
        activeKeys('welcomeScreen.description'),
        (fake) => {
          fake.respond(
            'chat-dev',
            published('r1', {
              config: { 'welcomeScreen.description': 'Welcome' },
              features: {},
            }),
          );
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable });
        },
      );
      await clock.advance(895_000);

      const degraded = await service.getClientConfig(anonymous);
      expect(degraded.metadata?.managed?.state).toBe('degraded');
      expect(cacheTtls.at(-1)).toBe(5_000);
      expect(degraded.metadata?.cacheTtlSeconds).toBe(5);

      await clock.advance(5_001);
      const stale = await service.getClientConfig(anonymous);
      expect(stale.metadata?.managed?.state).toBe('stale');
      expect(stale.config.welcomeScreenDescription).toBeNull();
    });
  });

  describe('feature gates', () => {
    it('enables a feature from a usable policy for every caller', async () => {
      const { service } = await featureStack({ enabled: true });
      expect(
        (await service.getClientConfig(anonymous)).features[
          'usageLimitsControl'
        ],
      ).toBe(true);
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, staff),
      ).resolves.toBe(true);
    });

    it('treats an explicit environment false as a kill switch', async () => {
      const { service } = await featureStack(
        { enabled: true },
        { USAGE_LIMITS_CONTROL_ENABLED: 'false' },
      );
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(false);
    });

    it('does not let an explicit environment true bypass unusable policy', async () => {
      const { service } = await buildStack(
        { ...activeKeys(FEATURE), USAGE_LIMITS_CONTROL_ENABLED: 'true' },
        (fake) =>
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable }),
      );
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, beta),
      ).resolves.toBe(false);
      expect(
        (await service.getClientConfig(beta)).features['usageLimitsControl'],
      ).toBe(false);
    });

    it('does not let an explicit environment true bypass an ended window', async () => {
      const { service } = await featureStack(
        {
          enabled: false,
          availability: { endsAt: '2026-11-01T00:00:00Z' },
        },
        { USAGE_LIMITS_CONTROL_ENABLED: 'true' },
      );
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, beta),
      ).resolves.toBe(false);
    });

    it('closes an active feature the usable snapshot has no policy for', async () => {
      const { service } = await featureStack(undefined, {
        USAGE_LIMITS_CONTROL_ENABLED: 'true',
      });
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, beta),
      ).resolves.toBe(false);
    });

    it('matches targeting against verified roles and never for anonymous callers', async () => {
      const { service } = await featureStack({
        enabled: true,
        targeting: { roles: ['beta'] },
      });
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, beta),
      ).resolves.toBe(true);
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, staff),
      ).resolves.toBe(false);
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(false);
      expect(
        (await service.getClientConfig(staff)).features['usageLimitsControl'],
      ).toBe(false);
      expect(
        (await service.getClientConfig(beta)).features['usageLimitsControl'],
      ).toBe(true);
    });

    it('opens a window on an unchanged snapshot', async () => {
      let startsAt = 0;
      const { flags, clock } = await buildStack(
        activeKeys(FEATURE),
        (fake, fakeClock) => {
          startsAt = fakeClock.now() + 30_000;
          fake.respondAlways(
            'chat-dev',
            published('r1', {
              config: {},
              features: {
                [FEATURE]: {
                  enabled: true,
                  availability: { startsAt: iso(startsAt) },
                },
              },
            }),
          );
        },
      );
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(false);
      await clock.advance(31_000);
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(true);
    });

    it('evaluates an exclusive end at call time, also while degraded', async () => {
      let endsAt = 0;
      const { flags, clock, runtime } = await buildStack(
        activeKeys(FEATURE),
        (fake, fakeClock) => {
          endsAt = fakeClock.now() + 120_000;
          fake.respond(
            'chat-dev',
            published('r1', {
              config: {},
              features: {
                [FEATURE]: {
                  enabled: true,
                  availability: { endsAt: iso(endsAt) },
                },
              },
            }),
          );
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable });
        },
      );
      await clock.advance(endsAt - clock.now() - 1);
      expect(runtime.captureView('ai-dial-chat').state).toBe('degraded');
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(true);
      await clock.advance(1);
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(false);
    });

    it('keeps a rolled-back ended window ended', async () => {
      const { flags, clock } = await buildStack(activeKeys(FEATURE), (fake) => {
        fake.respond(
          'chat-dev',
          published('r1', {
            config: {},
            features: { [FEATURE]: { enabled: true } },
          }),
        );
        /* A rollback: a new revision carrying an older payload whose window ended. */
        fake.respondAlways(
          'chat-dev',
          published('r2', {
            config: {},
            features: {
              [FEATURE]: {
                enabled: true,
                availability: {
                  startsAt: '2026-10-01T00:00:00Z',
                  endsAt: '2026-11-01T00:00:00Z',
                },
              },
            },
          }),
        );
      });
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(true);
      await clock.advance(INTERVAL);
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(false);
    });

    it('closes an active feature once the snapshot is stale, whatever the environment says', async () => {
      const { flags, clock } = await buildStack(
        { ...activeKeys(FEATURE), USAGE_LIMITS_CONTROL_ENABLED: 'true' },
        (fake) => {
          fake.respond(
            'chat-dev',
            published('r1', {
              config: {},
              features: { [FEATURE]: { enabled: true } },
            }),
          );
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable });
        },
      );
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(true);
      await clock.advance(900_001);
      await expect(
        flags.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(false);
    });

    it('keeps environment behavior while ai-dial-chat has no mapped instance', async () => {
      const { service } = await buildStack(
        {
          ...activeKeys(FEATURE),
          CLIENT_CONFIG_APP_IDS: 'ai-dial-chat,launchpad',
          MANAGED_CONFIG_INSTANCES: 'launchpad=launchpad-dev',
          USAGE_LIMITS_CONTROL_ENABLED: 'true',
        },
        (fake) =>
          fake.respondAlways('launchpad-dev', {
            kind: RuntimeReadKind.NotPublished,
          }),
      );
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(true);
      const response = await service.getClientConfig(anonymous);
      expect(response.features['usageLimitsControl']).toBe(true);
      expect(response.metadata?.managed).toBeUndefined();
    });

    it('keeps the environment tour while ai-dial-chat has no mapped instance', async () => {
      const tour = [{ id: 'local', target: 'navigation', title: 'Local' }];
      const { service } = await buildStack(
        {
          ...activeKeys('onboarding.hints'),
          CLIENT_CONFIG_APP_IDS: 'ai-dial-chat,launchpad',
          MANAGED_CONFIG_INSTANCES: 'launchpad=launchpad-dev',
          ONBOARDING_HINTS: JSON.stringify(tour),
        },
        (fake) =>
          fake.respondAlways('launchpad-dev', {
            kind: RuntimeReadKind.NotPublished,
          }),
      );
      const response = await service.getClientConfig(anonymous);
      expect(response.config.onboardingHints).toEqual([
        { ...tour[0], description: null, pages: [] },
      ]);
      expect(response.metadata?.managed).toBeUndefined();
    });

    it('keeps the legacy path for a feature that is not active', async () => {
      const { service } = await buildStack(
        {
          ...activeKeys('welcomeScreen.description'),
          USAGE_LIMITS_CONTROL_ENABLED: 'true',
        },
        (fake) =>
          fake.respondAlways(
            'chat-dev',
            published('r1', {
              config: {},
              features: { [FEATURE]: { enabled: false } },
            }),
          ),
      );
      await expect(
        service.isEnabled(FeatureKey.UsageLimitsControl, anonymous),
      ).resolves.toBe(true);
    });
  });

  describe('server guards', () => {
    const guardFor = (flags: FeatureFlagsService) =>
      new FeatureGuard(
        {
          getAllAndOverride: () => FeatureKey.UsageLimitsControl,
        } as unknown as Reflector,
        flags,
        {
          getRoles: (user: { roles?: string[] }) => user.roles ?? [],
        } as unknown as UserRolesService,
      );
    const contextFor = (user?: { sub: string; roles: string[] }) =>
      ({
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as never;

    it('agrees with client config for targeting', async () => {
      const { flags, service } = await featureStack({
        enabled: true,
        targeting: { roles: ['beta'] },
      });
      const guard = guardFor(flags);

      await expect(
        guard.canActivate(contextFor({ sub: 'u-beta', roles: ['beta'] })),
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(contextFor({ sub: 'u-staff', roles: ['staff'] })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        (await service.getClientConfig(staff)).features['usageLimitsControl'],
      ).toBe(false);
    });

    it('refuses after the window ends even if a browser still shows the feature', async () => {
      let endsAt = 0;
      const { flags, service, clock } = await buildStack(
        activeKeys(FEATURE),
        (fake, fakeClock) => {
          endsAt = fakeClock.now() + 10_000;
          fake.respondAlways(
            'chat-dev',
            published('r1', {
              config: {},
              features: {
                [FEATURE]: {
                  enabled: true,
                  availability: { endsAt: iso(endsAt) },
                },
              },
            }),
          );
        },
      );
      const browserCopy = await service.getClientConfig(beta);
      expect(browserCopy.features['usageLimitsControl']).toBe(true);

      await clock.advance(10_000);
      await expect(
        guardFor(flags).canActivate(
          contextFor({ sub: 'u-beta', roles: ['beta'] }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
