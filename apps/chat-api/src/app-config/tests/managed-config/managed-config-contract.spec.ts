import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ErrorObject } from 'ajv';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';
import { canonicalByteLength } from '../../managed-config/canonical-json';
import type { ManagedConfigArtifact } from '../../managed-config/managed-config-artifact';
import { MAX_MANAGED_PAYLOAD_BYTES } from '../../managed-config/managed-config.constants';
import { createStudioAjv } from './studio-contract.fixtures';

/*
 * Validates the 1.0.0 contract fixtures against the committed 1.0.0 schema
 * with Config Studio's Ajv options. The fixtures are versioned with the
 * schema: a MINOR successor must still accept every valid one.
 */
interface ExpectedError {
  readonly keyword: string;
  readonly instancePath: string;
}

interface ContractFixtures {
  readonly schemaVersion: string;
  readonly valid: readonly { name: string; payload: unknown }[];
  readonly invalid: readonly {
    name: string;
    payload: unknown;
    errors: readonly ExpectedError[];
  }[];
}

const fixtures = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/chat-ui-1.0.0.fixtures.json'), 'utf8'),
) as ContractFixtures;
const artifact = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../managed-config-schema/chat-ui-1.0.0.json'),
    'utf8',
  ),
) as ManagedConfigArtifact;

const validate = createStudioAjv().compile(artifact.schema);

const errorsOf = (payload: unknown): ExpectedError[] => {
  validate(payload);
  return (validate.errors ?? []).map((error: ErrorObject) => ({
    keyword: error.keyword,
    instancePath: error.instancePath,
  }));
};

describe('managed-config 1.0.0 contract', () => {
  it('validates fixtures of its own version', () => {
    expect(fixtures.schemaVersion).toBe(artifact.schemaVersion);
  });

  it.each(fixtures.valid)('accepts $name', ({ payload }) => {
    expect(errorsOf(payload)).toEqual([]);
  });

  it.each(fixtures.invalid)('rejects $name', ({ payload, errors }) => {
    const actual = errorsOf(payload);
    expect(actual.length).toBeGreaterThan(0);
    for (const expected of errors) {
      expect(actual).toContainEqual(expected);
    }
  });

  it('fits the largest valid payload within the Studio payload limit', () => {
    const largest = fixtures.valid.find(
      (fixture) => fixture.name === 'every bound at its maximum',
    );
    expect(largest).toBeDefined();
    expect(canonicalByteLength(largest?.payload)).toBeLessThanOrEqual(
      MAX_MANAGED_PAYLOAD_BYTES,
    );
  });

  it.each(CONFIG_DEFINITIONS.filter((definition) => definition.localOnly))(
    'rejects the local-only key $key as unknown',
    (definition) => {
      const section = definition.type === 'feature' ? 'features' : 'config';
      const value = definition.type === 'feature' ? { enabled: true } : 'x';
      expect(
        errorsOf({
          config: {},
          features: {},
          [section]: { [definition.key]: value },
        }),
      ).toContainEqual({
        keyword: 'additionalProperties',
        instancePath: `/${section}`,
      });
    },
  );

  it.each(
    CONFIG_DEFINITIONS.filter(
      (definition) => !definition.managed && !definition.localOnly,
    ),
  )(
    'rejects the unmanaged key $key until a version exports it',
    (definition) => {
      const section = definition.type === 'feature' ? 'features' : 'config';
      expect(
        errorsOf({
          config: {},
          features: {},
          [section]: { [definition.key]: 1 },
        }),
      ).toContainEqual({
        keyword: 'additionalProperties',
        instancePath: `/${section}`,
      });
    },
  );
});
