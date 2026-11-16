import { describe, expect, it } from 'vitest';
import {
  isManagedFeatureEnabled,
  isWindowActive,
  matchesTargeting,
  nextManagedBoundary,
} from '../../managed-runtime/managed-evaluation';
import {
  ManagedConfigState,
  type ManagedResolutionView,
  type ManagedSnapshot,
} from '../../managed-runtime/managed-runtime.types';

const START = '2026-12-01T00:00:00Z';
const END = '2026-12-02T00:00:00Z';
const startMs = Date.parse(START);
const endMs = Date.parse(END);
const FEATURE = 'features.usageLimitsControl';

const snapshotWith = (features: Record<string, unknown>): ManagedSnapshot => ({
  instanceId: 'chat-dev',
  appId: 'chat-ui',
  environment: 'dev',
  schemaVersion: '1.0.0',
  schemaSha256: 'a'.repeat(64),
  revisionId: 'r1',
  sha256: 'b'.repeat(64),
  publishedAt: '2026-11-20T09:55:00.000Z',
  payload: { config: {}, features },
  payloadSha256: 'c'.repeat(64),
});

const viewOf = (
  snapshot: ManagedSnapshot | undefined,
  now: number,
): ManagedResolutionView => ({
  appId: 'chat-ui',
  instanceId: 'chat-dev',
  state: snapshot ? ManagedConfigState.Fresh : ManagedConfigState.Unavailable,
  snapshot,
  now,
});

describe('isWindowActive', () => {
  it('has no time restriction without a window', () => {
    expect(isWindowActive(undefined, 0)).toBe(true);
  });

  it('includes the start instant', () => {
    expect(isWindowActive({ startsAt: START }, startMs - 1)).toBe(false);
    expect(isWindowActive({ startsAt: START }, startMs)).toBe(true);
  });

  it('excludes the end instant', () => {
    expect(isWindowActive({ endsAt: END }, endMs - 1)).toBe(true);
    expect(isWindowActive({ endsAt: END }, endMs)).toBe(false);
  });

  it('requires both bounds when both are present', () => {
    const window = { startsAt: START, endsAt: END };
    expect(isWindowActive(window, startMs - 1)).toBe(false);
    expect(isWindowActive(window, startMs)).toBe(true);
    expect(isWindowActive(window, endMs)).toBe(false);
  });

  it('accepts millisecond timestamps', () => {
    expect(
      isWindowActive({ startsAt: '2026-12-01T00:00:00.500Z' }, startMs + 499),
    ).toBe(false);
    expect(
      isWindowActive({ startsAt: '2026-12-01T00:00:00.500Z' }, startMs + 500),
    ).toBe(true);
  });
});

describe('matchesTargeting', () => {
  it('has no role restriction without targeting', () => {
    expect(matchesTargeting(undefined, undefined)).toBe(true);
  });

  it('needs at least one listed role', () => {
    const targeting = { roles: ['beta', 'staff'] };
    expect(matchesTargeting(targeting, ['staff'])).toBe(true);
    expect(matchesTargeting(targeting, ['viewer'])).toBe(false);
  });

  it('never matches an anonymous caller', () => {
    expect(matchesTargeting({ roles: ['beta'] }, undefined)).toBe(false);
    expect(matchesTargeting({ roles: ['beta'] }, [])).toBe(false);
  });
});

describe('nextManagedBoundary', () => {
  const snapshot = snapshotWith({
    [FEATURE]: {
      enabled: true,
      availability: { startsAt: START, endsAt: END },
    },
  });

  it('returns the earliest future boundary of the listed features', () => {
    expect(nextManagedBoundary(snapshot, [FEATURE], startMs - 10)).toBe(
      startMs,
    );
    expect(nextManagedBoundary(snapshot, [FEATURE], startMs)).toBe(endMs);
    expect(nextManagedBoundary(snapshot, [FEATURE], endMs)).toBeUndefined();
  });

  it('ignores features that are not listed', () => {
    expect(nextManagedBoundary(snapshot, [], 0)).toBeUndefined();
  });
});

describe('isManagedFeatureEnabled', () => {
  const gate = (
    state: Record<string, unknown> | undefined,
    overrides: Partial<Parameters<typeof isManagedFeatureEnabled>[0]> = {},
  ) =>
    isManagedFeatureEnabled({
      key: FEATURE,
      view: viewOf(snapshotWith(state ? { [FEATURE]: state } : {}), startMs),
      configuredEnabled: true,
      capabilityAvailable: true,
      roles: ['beta'],
      ...overrides,
    });

  it('enables a feature whose every gate holds', () => {
    expect(gate({ enabled: true })).toBe(true);
  });

  it('closes when the configured bit is not true', () => {
    expect(gate({ enabled: true }, { configuredEnabled: false })).toBe(false);
    expect(gate({ enabled: true }, { configuredEnabled: 'true' })).toBe(false);
  });

  it('closes without a usable snapshot', () => {
    expect(gate(undefined, { view: viewOf(undefined, startMs) })).toBe(false);
    expect(gate(undefined, { view: undefined })).toBe(false);
  });

  it('closes when the snapshot has no policy for the feature', () => {
    expect(gate(undefined)).toBe(false);
  });

  it('closes when the local capability is missing', () => {
    expect(gate({ enabled: true }, { capabilityAvailable: false })).toBe(false);
  });

  it('closes outside the window and for untargeted callers', () => {
    expect(gate({ enabled: true, availability: { endsAt: START } })).toBe(
      false,
    );
    expect(gate({ enabled: true, targeting: { roles: ['staff'] } })).toBe(
      false,
    );
    expect(
      gate(
        { enabled: true, targeting: { roles: ['beta'] } },
        { roles: undefined },
      ),
    ).toBe(false);
  });
});
