import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { ExplicitEnvironment } from '../../../config/explicit-environment';
import { validate } from '../../../config/validation';
import { AppConfigService } from '../../app-config.service';
import { CompositeConfigProvider } from '../../config-registry/composite-config.provider';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';
import { StaticDefaultsProvider } from '../../config-registry/static-defaults.provider';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { canonicalSha256 } from '../../managed-config/canonical-json';
import { ManagedConfigProvider } from '../../managed-runtime/managed-config.provider';
import { ManagedRuntimeService } from '../../managed-runtime/managed-runtime.service';
import type { RuntimeReadResult } from '../../managed-runtime/snapshot-reader';
import {
  candidate,
  createFakeClock,
  createFakeReader,
  type FakeClock,
  type FakeReader,
} from './managed-runtime.fixtures';

/** The variables every chat-api environment needs to validate. */
export const REQUIRED_ENVIRONMENT = {
  DIAL_CORE_URL: 'https://dial-core.example.com',
  AUTH_SESSION_SECRET: 'a'.repeat(64),
  AUTH_CALLBACK_BASE_URL: 'http://localhost:5000',
};

/** The managed reading of `ai-dial-chat` → `chat-dev`, with `keys` active. */
export const activeManagedEnvironment = (...keys: string[]) => ({
  MANAGED_CONFIG_MODE: 'active',
  MANAGED_CONFIG_INSTANCES: 'ai-dial-chat=chat-dev',
  MANAGED_CONFIG_API_KEY: 'reader-key',
  MANAGED_CONFIG_MAX_STALENESS_SECONDS: '900',
  MANAGED_CONFIG_ACTIVE_KEYS: keys.join(','),
});

/** A runtime-read 200 for one revision of `payload`. */
export const publishedRevision = (
  revisionId: string,
  payload: Record<string, unknown>,
  envelope: Record<string, unknown> = {},
): RuntimeReadResult =>
  candidate({
    revisionId,
    sha256: canonicalSha256({ revisionId, payload }),
    payload,
    ...envelope,
  });

/** The real resolution stack over a fake Core reader and clock. */
export interface ManagedStack {
  readonly service: AppConfigService;
  readonly runtime: ManagedRuntimeService;
  readonly clock: FakeClock;
  readonly fake: FakeReader;
  readonly flags: FeatureFlagsService;
  /** Every TTL the response cache was asked to store, in order. */
  readonly cacheTtls: number[];
}

const stacks: ManagedStack[] = [];

/*
 * The production provider chain (explicit ENV → managed → default) over a
 * fake Core reader. The memory cache honors TTLs on the fake clock, so cache
 * tests observe real expiry. Call `destroyManagedStacks` after each test.
 */
export const buildManagedStack = async (
  raw: Record<string, unknown>,
  respond: (fake: FakeReader, clock: FakeClock) => void = () => undefined,
): Promise<ManagedStack> => {
  const configService = new ConfigService<EnvironmentVariables>(
    validate({ ...REQUIRED_ENVIRONMENT, ...raw }),
  );
  const clock = createFakeClock();
  const fake = createFakeReader();
  respond(fake, clock);
  const runtime = new ManagedRuntimeService(configService, fake.reader, clock);
  await runtime.onApplicationBootstrap();
  const composite = new CompositeConfigProvider(
    new EnvConfigProvider(
      configService,
      ExplicitEnvironment.fromConfigService(configService),
    ),
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

/** Stops the refresh timers of every stack built since the last call. */
export const destroyManagedStacks = (): void => {
  for (const stack of stacks.splice(0)) stack.runtime.onModuleDestroy();
};
