import { ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRolesService } from '../../../auth/user-roles.service';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { ExplicitEnvironment } from '../../../config/explicit-environment';
import { validate } from '../../../config/validation';
import { AppConfigService } from '../../app-config.service';
import type { AppConfigEvalContext } from '../../app-config.types';
import { CompositeConfigProvider } from '../../config-registry/composite-config.provider';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';
import { StaticDefaultsProvider } from '../../config-registry/static-defaults.provider';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { FeatureKey } from '../../feature-flags/feature-key.enum';
import { FeatureGuard } from '../../feature-flags/feature.guard';
import { canonicalSha256 } from '../../managed-config/canonical-json';
import { PINNED_MANAGED_CONFIG_SCHEMA_SHA256 } from '../../managed-config/managed-config.constants';
import { ManagedConfigProvider } from '../../managed-runtime/managed-config.provider';
import { ManagedRuntimeService } from '../../managed-runtime/managed-runtime.service';
import {
  RuntimeReadKind,
  type RuntimeReadResult,
} from '../../managed-runtime/snapshot-reader';
import {
  candidate,
  createFakeClock,
  createFakeReader,
  type FakeClock,
  type FakeReader,
} from './managed-runtime.fixtures';

const REQUIRED = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};
const ACTIVE = {
  MANAGED_CONFIG_MODE: 'active',
  MANAGED_CONFIG_INSTANCES: 'chat-ui=chat-dev',
  MANAGED_CONFIG_API_KEY: 'reader-key',
  MANAGED_CONFIG_MAX_STALENESS_SECONDS: '900',
};
const FEATURE = 'features.usageLimitsControl';
const INTERVAL = 60_000;

const anonymous: AppConfigEvalContext = { appId: 'chat-ui' };
const beta: AppConfigEvalContext = {
  appId: 'chat-ui',
  userId: 'u-beta',
  roles: ['beta', 'staff'],
};
const staff: AppConfigEvalContext = {
  appId: 'chat-ui',
  userId: 'u-staff',
  roles: ['staff'],
};

/* A runtime-read 200 for one revision of `payload`. */
const published = (
  revisionId: string,
  payload: Record<string, unknown>,
): RuntimeReadResult =>
  candidate({
    revisionId,
    sha256: canonicalSha256({ revisionId, payload }),
    payload,
  });

const iso = (epochMs: number) => new Date(epochMs).toISOString();

interface Stack {
  readonly service: AppConfigService;
  readonly runtime: ManagedRuntimeService;
  readonly clock: FakeClock;
  readonly fake: FakeReader;
  readonly flags: FeatureFlagsService;
  readonly cacheTtls: number[];
}

const stacks: Stack[] = [];

/*
 * The real resolution stack over a fake Core reader. The memory cache
 * honors TTLs on the fake clock, so cache tests observe real expiry.
 */
const buildStack = async (
  raw: Record<string, unknown>,
  respond: (fake: FakeReader, clock: FakeClock) => void,
): Promise<Stack> => {
  const configService = new ConfigService<EnvironmentVariables>(
    validate({ ...REQUIRED, ...raw }),
  );
  const clock = createFakeClock();
  const fake = createFakeReader();
  respond(fake, clock);
  const runtime = new ManagedRuntimeService(configService, fake.reader, clock);
  await runtime.onApplicationBootstrap();
  const envProvider = new EnvConfigProvider(
    configService,
    ExplicitEnvironment.fromConfigService(configService),
  );
  const composite = new CompositeConfigProvider(
    envProvider,
    new StaticDefaultsProvider(),
    new ManagedConfigProvider(runtime),
  );
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  const cacheTtls: number[] = [];
  const cache = {
    get: async (key: string) => {
      const entry = entries.get(key);
      return entry && entry.expiresAt > clock.now() ? entry.value : undefined;
    },
    set: async (key: string, value: unknown, ttl: number) => {
      cacheTtls.push(ttl);
      entries.set(key, { value, expiresAt: clock.now() + ttl });
    },
  };
  const service = new AppConfigService(
    composite,
    cache as never,
    configService,
    runtime,
  );
  const stack = {
    service,
    runtime,
    clock,
    fake,
    flags: new FeatureFlagsService(service),
    cacheTtls,
  };
  stacks.push(stack);
  return stack;
};

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
    for (const stack of stacks.splice(0)) stack.runtime.onModuleDestroy();
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

    describe('spending limits mode (schema 1.1.0)', () => {
      const payload = {
        config: { 'usageLimits.spendingLimitsMode': 'enforce' },
        features: {},
      };
      const modeStack = (raw: Record<string, unknown> = {}) =>
        buildStack(
          { ...activeKeys('usageLimits.spendingLimitsMode'), ...raw },
          (fake) =>
            fake.respondAlways(
              'chat-dev',
              candidate({
                revisionId: 'r1',
                schemaVersion: '1.1.0',
                schemaSha256: PINNED_MANAGED_CONFIG_SCHEMA_SHA256['1.1.0'],
                sha256: canonicalSha256({ revisionId: 'r1', payload }),
                payload,
              }),
            ),
        );

      it('applies the managed mode when the environment is silent', async () => {
        const { service } = await modeStack();
        const response = await service.getClientConfig(anonymous);
        expect(response.config.spendingLimitsMode).toBe('enforce');
      });

      it('keeps an explicit environment mode', async () => {
        const { service } = await modeStack({ SPENDING_LIMITS_MODE: 'shadow' });
        const response = await service.getClientConfig(anonymous);
        expect(response.config.spendingLimitsMode).toBe('shadow');
      });
    });

    it('falls back to the default and reports a stale snapshot', async () => {
      const { service, clock } = await buildStack(
        activeKeys('usageLimits.warningThresholdPercent'),
        (fake) => {
          fake.respond(
            'chat-dev',
            published('r1', {
              config: { 'usageLimits.warningThresholdPercent': 80 },
              features: {},
            }),
          );
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable });
        },
      );
      expect(
        (await service.getClientConfig(anonymous)).config
          .usageLimitsWarningThresholdPercent,
      ).toBe(80);

      await clock.advance(900_001);
      const response = await service.getClientConfig(anonymous);
      expect(response.config.usageLimitsWarningThresholdPercent).toBe(75);
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
      expect(runtime.captureView('chat-ui').state).toBe('degraded');
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

    it('keeps environment behavior while chat-ui has no mapped instance', async () => {
      const { service } = await buildStack(
        {
          ...activeKeys(FEATURE),
          CLIENT_CONFIG_APP_IDS: 'chat-ui,launchpad',
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
