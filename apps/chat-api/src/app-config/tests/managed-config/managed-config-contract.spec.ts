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
 * Validates each committed version's contract fixtures against that version's
 * schema with Config Studio's Ajv options. The fixtures are versioned with
 * the schema: a MINOR successor must still accept every valid one.
 *
 * No committed version manages a feature, so no payload can carry a feature
 * state. The 1.0.0 `featureStates` fixtures validate bare states against the
 * exported `$defs/featureState`, which every managed feature of a later
 * version references; the definition is unchanged in 1.1.0.
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
  readonly featureStates?: {
    readonly valid: readonly { name: string; state: unknown }[];
    readonly invalid: readonly {
      name: string;
      state: unknown;
      errors: readonly ExpectedError[];
    }[];
  };
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;

const fixturesOf = (version: string): ContractFixtures =>
  readJson(join(__dirname, `fixtures/ai-dial-chat-${version}.fixtures.json`));
const artifactOf = (version: string): ManagedConfigArtifact =>
  readJson(
    join(
      __dirname,
      `../../../../managed-config-schema/ai-dial-chat-${version}.json`,
    ),
  );

type JsonNode = Record<string, unknown>;

type Validator = ReturnType<ReturnType<typeof createStudioAjv>['compile']>;

const errorsWith =
  (validator: Validator) =>
  (instance: unknown): ExpectedError[] => {
    validator(instance);
    return (validator.errors ?? []).map((error: ErrorObject) => ({
      keyword: error.keyword,
      instancePath: error.instancePath,
    }));
  };

describe.each(['1.0.0', '1.1.0'])('managed-config %s contract', (version) => {
  const fixtures = fixturesOf(version);
  const artifact = artifactOf(version);
  const errorsOf = errorsWith(createStudioAjv().compile(artifact.schema));
  const featureStateSchema: typeof artifact.schema = {
    $schema: artifact.schema['$schema'],
    $defs: artifact.schema['$defs'],
    $ref: '#/$defs/featureState',
  };
  const featureStateErrorsOf = errorsWith(
    createStudioAjv().compile(featureStateSchema),
  );
  const managedKeys = Object.keys(
    (
      (artifact.schema['properties'] as Record<string, unknown>)['config'] as {
        properties: Record<string, unknown>;
      }
    ).properties,
  );

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

  it.each(fixtures.featureStates?.valid ?? [])(
    'accepts the feature state $name',
    ({ state }) => {
      expect(featureStateErrorsOf(state)).toEqual([]);
    },
  );

  it.each(fixtures.featureStates?.invalid ?? [])(
    'rejects the feature state $name',
    ({ state, errors }) => {
      const actual = featureStateErrorsOf(state);
      expect(actual.length).toBeGreaterThan(0);
      for (const expected of errors) {
        expect(actual).toContainEqual(expected);
      }
    },
  );

  it('fits every valid fixture within the Studio payload limit', () => {
    for (const { name, payload } of fixtures.valid) {
      expect(canonicalByteLength(payload), name).toBeLessThanOrEqual(
        MAX_MANAGED_PAYLOAD_BYTES,
      );
    }
  });

  it('rejects every registry key this version does not export', () => {
    for (const definition of CONFIG_DEFINITIONS) {
      if (managedKeys.includes(definition.key)) continue;
      const section = definition.type === 'feature' ? 'features' : 'config';
      expect(
        errorsOf({
          config: {},
          features: {},
          [section]: { [definition.key]: 1 },
        }),
        definition.key,
      ).toContainEqual({
        keyword: 'additionalProperties',
        instancePath: `/${section}`,
      });
    }
  });
});

describe('managed-config 1.1.0 announcements and celebrations', () => {
  const fixtures = fixturesOf('1.1.0');
  const artifact = artifactOf('1.1.0');
  const errorsOf = errorsWith(createStudioAjv().compile(artifact.schema));
  const schema = artifact.schema as {
    properties: { config: { properties: Record<string, JsonNode> } };
    'dial:semanticConstraints': { code: string }[];
  };
  const property = (key: string): JsonNode =>
    schema.properties.config.properties[key];
  const payloadOf = (name: string): { config: Record<string, unknown> } => {
    const fixture = fixtures.valid.find((candidate) => candidate.name === name);
    if (!fixture) throw new Error(`No fixture named ${name}`);
    return fixture.payload as { config: Record<string, unknown> };
  };

  it('exports the ten 1.1.0 keys and no feature', () => {
    expect(Object.keys(schema.properties.config.properties).sort()).toEqual([
      'announcement.description',
      'announcement.items',
      'announcement.title',
      'onboarding.hints',
      'ui.activeEventId',
      'ui.celebrationDelivery.externalEvents',
      'ui.celebrationDelivery.externalScenes',
      'ui.celebrationDelivery.mode',
      'ui.celebrationDelivery.revision',
      'ui.celebrationsEnabledByDefault',
    ]);
    expect(
      (artifact.schema['properties'] as Record<string, { properties: object }>)[
        'features'
      ].properties,
    ).toEqual({});
  });

  it('keeps the semantic constraints of 1.0.0', () => {
    expect(schema['dial:semanticConstraints'].map(({ code }) => code)).toEqual([
      'calendar_date',
      'window_order',
    ]);
  });

  it('tells editors which HTML survives and that the title is plain text', () => {
    const itemDescription = (
      (property('announcement.items')['items'] as JsonNode)[
        'properties'
      ] as Record<string, JsonNode>
    )['description'];
    for (const node of [
      property('announcement.description'),
      itemDescription,
    ]) {
      for (const tag of [
        'target',
        'rel',

        '<b>',
        '<strong>',
        '<em>',
        '<br>',
        '<span>',
        '<a href>',
      ]) {
        expect(node['description']).toContain(tag);
      }
    }
    expect(property('announcement.title')['description']).toContain(
      'markup is shown as typed',
    );
  });

  it('names the built-in events, none and the external events list for the event key', () => {
    const description = String(property('ui.activeEventId')['description']);
    for (const text of ['halloween', 'new-year', 'none', 'external events']) {
      expect(description).toContain(text);
    }
  });

  it('carries no URL member except the announcement link address', () => {
    const urlMembers: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return;
      for (const [name, child] of Object.entries(node)) {
        if (/url|href|host|path|source/i.test(name))
          urlMembers.push(`${path}/${name}`);
        walk(child, `${path}/${name}`);
      }
    };
    walk(schema.properties.config.properties, '');
    expect(urlMembers).toEqual([
      '/announcement.items/items/properties/link/properties/href',
    ]);
  });

  it('refuses a publication of every key at its maximum as a whole', () => {
    const config = Object.assign(
      {},
      ...fixtures.valid
        .filter(
          ({ name }) =>
            name.endsWith('at its maximum') ||
            name.endsWith('at their maximum'),
        )
        .map(({ payload }) => (payload as { config: object }).config),
    ) as Record<string, unknown>;
    expect(Object.keys(config)).toHaveLength(8);
    const everything = { config, features: {} };
    expect(errorsOf(everything)).toEqual([]);
    expect(canonicalByteLength(everything)).toBeGreaterThan(
      MAX_MANAGED_PAYLOAD_BYTES,
    );
  });

  it('fits the representative publication', () => {
    const { config } = payloadOf('the representative publication');
    expect(config['onboarding.hints']).toHaveLength(10);
    expect(config['announcement.items']).toHaveLength(3);
    expect(config['ui.celebrationDelivery.externalScenes']).toHaveLength(8);
    expect(config['ui.celebrationDelivery.externalEvents']).toHaveLength(4);
  });

  /* The examples of config/tests/validation.spec.ts. The schema also rejects
   * an active event ID over 64 characters and repeated list entries, which the
   * environment has no bound for or de-duplicates. */
  it.each([
    [
      'ui.activeEventId',
      ['none', 'halloween', 'new-year', 'product-launch-2027'],
      [
        '',
        ' ',
        'Halloween',
        'new_year',
        '-event',
        'event-',
        'new--year',
        '../halloween',
        'new year',
      ],
    ],
    [
      'ui.celebrationDelivery.mode',
      ['bundled', 'prefer-external'],
      ['external'],
    ],
    [
      'ui.celebrationDelivery.revision',
      ['0', '2026-11-15.1'],
      ['rev 1', 'x'.repeat(65)],
    ],
    [
      'ui.celebrationDelivery.externalScenes',
      ['new-year/snowman-delivery'],
      [
        'new-year/Snowman',
        'new-year',
        'new-year/snowman/extra',
        `new-year/${'a'.repeat(65)}`,
      ],
    ],
    [
      'ui.celebrationDelivery.externalEvents',
      ['company-anniversary'],
      ['Company_Anniversary', 'a'.repeat(65)],
    ],
  ])('applies the environment rules to %s', (key, accepted, rejected) => {
    const isList =
      key.endsWith('externalScenes') || key.endsWith('externalEvents');
    const payload = (value: string) => ({
      config: { [key]: isList ? [value] : value },
      features: {},
    });
    for (const value of accepted) {
      expect(errorsOf(payload(value)), value).toEqual([]);
    }
    for (const value of rejected) {
      expect(errorsOf(payload(value)).length, value).toBeGreaterThan(0);
    }
  });
});
