import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';
import { canonicalByteLength } from '../../managed-config/canonical-json';
import {
  isManagedKey,
  managedConfigKey,
} from '../../managed-config/key-management';
import {
  buildManagedConfigArtifact,
  buildManagedConfigIndex,
} from '../../managed-config/managed-config-artifact';
import {
  buildManagedConfigSchema,
  managedConfigSchemaId,
  type JsonSchemaObject,
} from '../../managed-config/managed-config-schema';
import {
  MANAGED_CONFIG_APP_ID,
  MANAGED_CONFIG_SCHEMA_VERSION,
  MAX_MANAGED_SCHEMA_BYTES,
  SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS,
} from '../../managed-config/managed-config.constants';
import { KeyManagementKind } from '../../managed-config/managed-config.types';
import {
  createStudioAjv,
  findStudioStructuralViolations,
  findStudioUploadViolations,
} from './studio-contract.fixtures';

const generate = () =>
  buildManagedConfigSchema(CONFIG_DEFINITIONS, MANAGED_CONFIG_SCHEMA_VERSION);

const propertiesOf = (schema: JsonSchemaObject, section: string) =>
  ((schema['properties'] as JsonSchemaObject)[section] as JsonSchemaObject)[
    'properties'
  ] as JsonSchemaObject;

describe('buildManagedConfigSchema', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is deterministic', () => {
    expect(generate()).toEqual(generate());
    expect(JSON.stringify(generate())).toBe(JSON.stringify(generate()));
  });

  it('does not read the environment', () => {
    const clean = generate();
    vi.stubEnv('ANNOUNCEMENT_TITLE', 'Leaked title');
    vi.stubEnv(
      'ONBOARDING_HINTS',
      '[{"id":"leak","target":"new-chat","title":"Leaked hint"}]',
    );
    vi.stubEnv('USAGE_LIMITS_WARNING_THRESHOLD_PERCENT', '90');
    vi.stubEnv('DIAL_API_KEY', 'secret-api-key');
    const populated = generate();

    expect(populated).toEqual(clean);
    const text = JSON.stringify(populated);
    expect(text).not.toContain('Leaked title');
    expect(text).not.toContain('Leaked hint');
    expect(text).not.toContain('secret-api-key');
  });

  it('declares the 2020-12 dialect and a versioned URN id', () => {
    const schema = generate();
    expect(schema['$schema']).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
    expect(schema['$id']).toBe('urn:dial:ai-dial-chat:managed-config:1.3.0');
    expect(managedConfigSchemaId('2.3.4')).toBe(
      'urn:dial:ai-dial-chat:managed-config:2.3.4',
    );
  });

  it('has a closed { config, features } root', () => {
    const schema = generate();
    expect(schema['type']).toBe('object');
    expect(schema['additionalProperties']).toBe(false);
    expect(schema['required']).toEqual(['config', 'features']);
    for (const section of ['config', 'features']) {
      const node = (schema['properties'] as JsonSchemaObject)[
        section
      ] as JsonSchemaObject;
      expect(node['type']).toBe('object');
      expect(node['additionalProperties']).toBe(false);
    }
  });

  it('exports exactly the 1.2.0 managed keys and feature, in display order', () => {
    const schema = generate();
    expect(Object.keys(propertiesOf(schema, 'config'))).toEqual([
      'announcement.title',
      'announcement.description',
      'announcement.items',
      'welcomeScreen.description',
      'onboarding.hints',
      'ui.activeEventId',
      'ui.celebrationsEnabledByDefault',
      'ui.celebrationDelivery.mode',
      'ui.celebrationDelivery.revision',
      'ui.celebrationDelivery.externalScenes',
      'ui.celebrationDelivery.externalEvents',
      'fileManager.availableTabs',
      'usageLimits.warningThresholdPercent',
      'usageLimits.spendingLimitsMode',
    ]);
    expect(Object.keys(propertiesOf(schema, 'features'))).toEqual([
      'features.usageLimitsControl',
    ]);
  });

  it('never exports a local-only or unmanaged key', () => {
    const exported = new Set([
      ...Object.keys(propertiesOf(generate(), 'config')),
      ...Object.keys(propertiesOf(generate(), 'features')),
    ]);
    for (const definition of CONFIG_DEFINITIONS) {
      if (!isManagedKey(definition)) {
        expect(exported.has(definition.key), definition.key).toBe(false);
      }
    }
  });

  it('emits Studio editor annotations', () => {
    const schema = generate();
    const hints = propertiesOf(schema, 'config')[
      'onboarding.hints'
    ] as JsonSchemaObject;
    expect(hints['title']).toBe('Onboarding tour');
    expect(hints['dial:meta']).toEqual({ 'dial:propertyOrder': 15 });
    expect(hints).not.toHaveProperty('isHidden');
    const feature = propertiesOf(schema, 'features')[
      'features.usageLimitsControl'
    ] as JsonSchemaObject;
    expect(feature['$ref']).toBe('#/$defs/featureState');
    expect(feature['title']).toBe('Usage-limits control');
  });

  it('emits isHidden only for a hidden key', () => {
    const hidden = CONFIG_DEFINITIONS.map((definition) =>
      definition.key === 'onboarding.hints' &&
      definition.management?.kind === KeyManagementKind.ManagedConfig
        ? {
            ...definition,
            management: managedConfigKey({
              ...definition.management.contract,
              isHidden: true,
            }),
          }
        : definition,
    );
    const schema = buildManagedConfigSchema(hidden, '1.0.0');
    expect(
      (propertiesOf(schema, 'config')['onboarding.hints'] as JsonSchemaObject)[
        'isHidden'
      ],
    ).toBe(true);
  });

  it('takes defaults only from the registry and omits null ones', () => {
    expect(
      (
        propertiesOf(generate(), 'config')[
          'onboarding.hints'
        ] as JsonSchemaObject
      )['default'],
    ).toEqual([]);
    const real = propertiesOf(generate(), 'config');
    expect(
      (real['ui.celebrationDelivery.mode'] as JsonSchemaObject)['default'],
    ).toBe('bundled');
    expect(
      (real['ui.celebrationDelivery.revision'] as JsonSchemaObject)['default'],
    ).toBe('0');
    expect(
      (real['ui.celebrationsEnabledByDefault'] as JsonSchemaObject)['default'],
    ).toBe(true);
    for (const nullDefault of [
      'announcement.title',
      'announcement.description',
      'ui.activeEventId',
    ]) {
      expect(real[nullDefault], nullDefault).not.toHaveProperty('default');
    }
    expect(
      (real['usageLimits.warningThresholdPercent'] as JsonSchemaObject)[
        'default'
      ],
    ).toBe(75);
    expect(
      (real['usageLimits.spendingLimitsMode'] as JsonSchemaObject)['default'],
    ).toBe('off');
    expect(
      (real['fileManager.availableTabs'] as JsonSchemaObject)['default'],
    ).toEqual(['all', 'my_files', 'shared', 'organization']);
    expect(real['welcomeScreen.description']).not.toHaveProperty('default');
  });

  it('validates each default against its own schema', () => {
    const ajv = createStudioAjv();
    const config = propertiesOf(generate(), 'config');
    for (const [key, node] of Object.entries(config)) {
      const property = node as JsonSchemaObject;
      if (!('default' in property)) continue;
      const validate = ajv.compile(property as object);
      expect(validate(property['default']), key).toBe(true);
    }
  });

  it('passes Studio structural rules', () => {
    expect(findStudioStructuralViolations(generate())).toEqual([]);
    expect(
      findStudioUploadViolations(
        buildManagedConfigArtifact(
          CONFIG_DEFINITIONS,
          MANAGED_CONFIG_SCHEMA_VERSION,
        ) as unknown as Record<string, unknown>,
        MANAGED_CONFIG_APP_ID,
      ),
    ).toEqual([]);
  });

  it('detects violations of Studio structural rules', () => {
    expect(
      findStudioStructuralViolations({
        type: 'object',
        properties: {
          a: { $ref: 'https://example.com/schema' },
          b: { $id: 'urn:nested' },
        },
      }),
    ).toEqual([
      '/properties/a/$ref: external reference',
      '/properties/b/$id: nested $id',
    ]);
    expect(findStudioStructuralViolations({ type: 'array' })).toEqual([
      'root type is not object',
    ]);
  });

  it('compiles under Ajv 2020 with Studio options', () => {
    const ajv = createStudioAjv();
    expect(ajv.validateSchema(generate())).toBe(true);
    expect(() => ajv.compile(generate())).not.toThrow();
  });

  it('fits the Studio size limit', () => {
    const bytes = canonicalByteLength(generate());
    expect(bytes).toBeLessThanOrEqual(MAX_MANAGED_SCHEMA_BYTES);
    expect(bytes).toBeGreaterThan(1000);
  });

  it('builds the artifact and index from the same schema', () => {
    const artifact = buildManagedConfigArtifact(
      CONFIG_DEFINITIONS,
      MANAGED_CONFIG_SCHEMA_VERSION,
    );
    expect(Object.keys(artifact)).toEqual(['appId', 'schemaVersion', 'schema']);
    expect(artifact.appId).toBe('ai-dial-chat');
    const index = buildManagedConfigIndex([artifact]);
    expect(index).toMatchObject({
      format: 'dial-managed-config-schema-index@1',
      appId: 'ai-dial-chat',
      current: '1.3.0',
      supported: SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS,
    });
    expect(index.versions).toEqual([
      {
        schemaVersion: '1.3.0',
        file: 'ai-dial-chat-1.3.0.json',
        schemaSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        canonicalBytes: canonicalByteLength(artifact.schema),
      },
    ]);
  });

  it('orders index versions semantically', () => {
    const at = (version: string) => ({
      appId: 'ai-dial-chat',
      schemaVersion: version,
      schema: { type: 'object' },
    });
    const index = buildManagedConfigIndex([
      at('1.10.0'),
      at('1.2.0'),
      at('1.9.3'),
    ]);
    expect(index.versions.map((entry) => entry.schemaVersion)).toEqual([
      '1.2.0',
      '1.9.3',
      '1.10.0',
    ]);
    expect(index.current).toBe('1.10.0');
  });

  it.each(['01.0.0', '1.0', '1.0.0-beta', '1234567.0.0'])(
    'rejects the invalid schema version %s',
    (version) => {
      expect(() =>
        buildManagedConfigArtifact(CONFIG_DEFINITIONS, version),
      ).toThrow(TypeError);
    },
  );
});
