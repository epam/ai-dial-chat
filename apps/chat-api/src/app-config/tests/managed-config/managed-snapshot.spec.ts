import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ManagedConfigIndex } from '../../managed-config/managed-config-artifact';
import type { ManagedConfigSnapshot } from '../../managed-config/managed-config.types';
import {
  ManagedSnapshotRejection,
  checkManagedSnapshot,
  type ManagedSnapshotExpectation,
} from '../../managed-config/managed-snapshot';

const index = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../managed-config-schema/index.json'),
    'utf8',
  ),
) as ManagedConfigIndex;
const SCHEMA_SHA256 = index.versions.find(
  (entry) => entry.schemaVersion === '1.0.0',
)?.schemaSha256 as string;

const expected: ManagedSnapshotExpectation = {
  instanceId: 'chat-dev',
  environment: 'dev',
  schemaHashes: new Map(
    index.versions.map((entry) => [entry.schemaVersion, entry.schemaSha256]),
  ),
};

const snapshot = (
  overrides: Partial<ManagedConfigSnapshot> = {},
): ManagedConfigSnapshot => ({
  instanceId: 'chat-dev',
  appId: 'chat-ui',
  environment: 'dev',
  schemaVersion: '1.0.0',
  schemaSha256: SCHEMA_SHA256,
  revisionId: 'rev-1',
  sha256: 'a'.repeat(64),
  publishedAt: '2026-11-06T10:00:00Z',
  payload: { config: {}, features: {} },
  ...overrides,
});

const NONE = new Map<string, string>();

describe('checkManagedSnapshot', () => {
  it('reads the hash of the committed 1.0.0 artifact', () => {
    expect(SCHEMA_SHA256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts a matching snapshot', () => {
    expect(checkManagedSnapshot(snapshot(), expected, NONE)).toEqual({
      ok: true,
    });
  });

  it('accepts a repeated revision with the same sha256', () => {
    expect(
      checkManagedSnapshot(
        snapshot(),
        expected,
        new Map([['rev-1', 'a'.repeat(64)]]),
      ),
    ).toEqual({ ok: true });
  });

  it('ignores the environment when none is expected', () => {
    expect(
      checkManagedSnapshot(
        snapshot({ environment: 'prod' }),
        { ...expected, environment: undefined },
        NONE,
      ),
    ).toEqual({ ok: true });
  });

  it.each<[string, Partial<ManagedConfigSnapshot>, ManagedSnapshotRejection]>([
    [
      'another app',
      { appId: 'other-app' },
      ManagedSnapshotRejection.AppMismatch,
    ],
    [
      'another instance',
      { instanceId: 'chat-prod' },
      ManagedSnapshotRejection.InstanceMismatch,
    ],
    [
      'another environment',
      { environment: 'prod' },
      ManagedSnapshotRejection.EnvironmentMismatch,
    ],
    [
      'a missing environment',
      { environment: undefined },
      ManagedSnapshotRejection.EnvironmentMismatch,
    ],
    [
      'an unsupported version',
      { schemaVersion: '2.0.0' },
      ManagedSnapshotRejection.UnsupportedSchema,
    ],
    [
      'the same version with another schema',
      { schemaSha256: 'b'.repeat(64) },
      ManagedSnapshotRejection.SchemaHashMismatch,
    ],
    [
      'an empty revision id',
      { revisionId: '' },
      ManagedSnapshotRejection.InvalidIdentity,
    ],
    [
      'an empty sha256',
      { sha256: '' },
      ManagedSnapshotRejection.InvalidIdentity,
    ],
    [
      'a payload over the limit',
      {
        payload: {
          config: { 'announcement.title': 'x'.repeat(57_344) },
          features: {},
        },
      },
      ManagedSnapshotRejection.PayloadTooLarge,
    ],
    [
      'a payload with no JSON form',
      { payload: undefined },
      ManagedSnapshotRejection.PayloadTooLarge,
    ],
  ])('rejects %s', (_name, overrides, code) => {
    expect(checkManagedSnapshot(snapshot(overrides), expected, NONE)).toEqual({
      ok: false,
      code,
    });
  });

  it('rejects a rewritten revision', () => {
    expect(
      checkManagedSnapshot(
        snapshot({ sha256: 'c'.repeat(64) }),
        expected,
        new Map([['rev-1', 'a'.repeat(64)]]),
      ),
    ).toEqual({ ok: false, code: ManagedSnapshotRejection.RevisionChanged });
  });

  it('rejects a version this build does not list even when a hash is known', () => {
    expect(
      checkManagedSnapshot(
        snapshot({ schemaVersion: '1.1.0', schemaSha256: 'd'.repeat(64) }),
        {
          ...expected,
          schemaHashes: new Map([
            ...expected.schemaHashes,
            ['1.1.0', 'd'.repeat(64)],
          ]),
        },
        NONE,
      ),
    ).toEqual({ ok: false, code: ManagedSnapshotRejection.UnsupportedSchema });
  });

  it('is wired to no provider, service or module', () => {
    const sourceRoot = join(__dirname, '../../..');
    const sources: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== 'tests') walk(path);
        } else if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) {
          sources.push(path);
        }
      }
    };
    walk(sourceRoot);

    const referencing = sources
      .filter((path) => readFileSync(path, 'utf8').includes('managed-snapshot'))
      .map((path) => relative(sourceRoot, path));
    expect(referencing).toEqual([]);
    expect(
      readFileSync(join(sourceRoot, 'app-config/app-config.module.ts'), 'utf8'),
    ).not.toMatch(/checkManagedSnapshot|managed-snapshot/);
  });
});
