import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import { canonicalSha256 } from '../../managed-config/canonical-json';
import { PINNED_MANAGED_CONFIG_SCHEMA_SHA256 } from '../../managed-config/managed-config.constants';
import { ManagedConfigProvider } from '../../managed-runtime/managed-config.provider';
import { ManagedRuntimeService } from '../../managed-runtime/managed-runtime.service';
import type { ManagedRuntimeClock } from '../../managed-runtime/refresh-scheduler';
import type {
  ManagedSnapshotReader,
  RuntimeReadResult,
} from '../../managed-runtime/snapshot-reader';
import { RuntimeReadKind } from '../../managed-runtime/snapshot-reader';

/** A clock whose time and timers move only when the test advances them. */
export interface FakeClock extends ManagedRuntimeClock {
  /** Moves time forward, firing due timers in order. */
  advance(ms: number): Promise<void>;
  /** The delays of the timers currently pending, in creation order. */
  pendingDelays(): number[];
  /** Sets what `random()` returns next. */
  setRandom(value: number): void;
}

/* Lets promise callbacks queued by fired timers run. */
export const flushPromises = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

export const createFakeClock = (
  start = Date.UTC(2026, 10, 20, 10),
): FakeClock => {
  let now = start;
  let random = 0;
  let nextId = 0;
  const timers = new Map<
    number,
    { at: number; delay: number; callback: () => void }
  >();
  return {
    now: () => now,
    random: () => random,
    setRandom: (value) => {
      random = value;
    },
    setTimer: (callback, delayMs) => {
      nextId += 1;
      timers.set(nextId, { at: now + delayMs, delay: delayMs, callback });
      return nextId;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    pendingDelays: () => [...timers.values()].map((timer) => timer.delay),
    advance: async (ms) => {
      const target = now + ms;
      for (;;) {
        await flushPromises();
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort(([, a], [, b]) => a.at - b.at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = target;
      await flushPromises();
    },
  };
};

/** The environment a managed deployment needs, before per-test overrides. */
export const MANAGED_ENVIRONMENT: Partial<EnvironmentVariables> = {
  MANAGED_CONFIG_MODE: undefined,
  MANAGED_CONFIG_INSTANCES: ['chat-ui=chat-dev'],
  MANAGED_CONFIG_API_KEY: 'reader-key',
  MANAGED_CONFIG_MAX_STALENESS_SECONDS: 900,
  MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS: 60,
  MANAGED_CONFIG_CLIENT_REFRESH_SECONDS: 120,
  MANAGED_CONFIG_ACTIVE_KEYS: [],
  CLIENT_CONFIG_APP_IDS: ['chat-ui'],
};

/** A reader whose results the test queues per instance. */
export interface FakeReader {
  readonly reader: ManagedSnapshotReader;
  /** Instances read, in order. */
  readonly calls: string[];
  /** The next result (or promise of one) for an instance. */
  respond(
    instanceId: string,
    result: RuntimeReadResult | Promise<RuntimeReadResult>,
  ): void;
  /** The result every later read of an instance gets once its queue is empty. */
  respondAlways(instanceId: string, result: RuntimeReadResult): void;
}

export const createFakeReader = (): FakeReader => {
  const queues = new Map<
    string,
    (RuntimeReadResult | Promise<RuntimeReadResult>)[]
  >();
  const fallbacks = new Map<string, RuntimeReadResult>();
  const calls: string[] = [];
  return {
    calls,
    reader: {
      read: vi.fn(async (instanceId: string) => {
        calls.push(instanceId);
        const next = queues.get(instanceId)?.shift();
        return (
          (await next) ??
          fallbacks.get(instanceId) ?? { kind: RuntimeReadKind.Unavailable }
        );
      }),
    } as unknown as ManagedSnapshotReader,
    respond: (instanceId, result) => {
      queues.set(instanceId, [...(queues.get(instanceId) ?? []), result]);
    },
    respondAlways: (instanceId, result) => {
      fallbacks.set(instanceId, result);
    },
  };
};

/** A runtime service over a fake reader and clock. */
export const createManagedRuntime = (
  environment: Partial<EnvironmentVariables> = {},
  reader: ManagedSnapshotReader = createFakeReader().reader,
  clock: ManagedRuntimeClock = createFakeClock(),
): ManagedRuntimeService =>
  new ManagedRuntimeService(
    new ConfigService<EnvironmentVariables>(environment),
    reader,
    clock,
  );

/** A runtime service in mode `off`, as every deployment without managed reading has. */
export const createInertManagedRuntime = (): ManagedRuntimeService =>
  createManagedRuntime({});

/** The slot-1 provider over a given runtime service. */
export const createManagedProvider = (
  runtime: ManagedRuntimeService = createInertManagedRuntime(),
): ManagedConfigProvider => new ManagedConfigProvider(runtime);

const CHAT_UI_SCHEMA_SHA256 = PINNED_MANAGED_CONFIG_SCHEMA_SHA256['1.0.0'];

/** A runtime-read 200 body for `chat-ui` → `chat-dev`, with overrides. */
export const snapshotBody = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  const payload = (overrides['payload'] as Record<string, unknown>) ?? {
    config: {},
    features: {},
  };
  return {
    instanceId: 'chat-dev',
    appId: 'chat-ui',
    environment: 'dev',
    schemaVersion: '1.0.0',
    schemaSha256: CHAT_UI_SCHEMA_SHA256,
    revisionId: '20261120T095500000Z-0123456789abcdef',
    sha256: canonicalSha256({
      revision: overrides['revisionId'] ?? 'r1',
      payload,
    }),
    publishedAt: '2026-11-20T09:55:00.000Z',
    payload,
    ...overrides,
  };
};

/** A runtime-read candidate result for `snapshotBody(overrides)`. */
export const candidate = (
  overrides: Record<string, unknown> = {},
): RuntimeReadResult => ({
  kind: RuntimeReadKind.Candidate,
  body: snapshotBody(overrides),
});
