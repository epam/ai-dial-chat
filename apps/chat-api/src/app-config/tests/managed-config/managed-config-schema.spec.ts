import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';
import { canonicalByteLength } from '../../managed-config/canonical-json';
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
    vi.stubEnv('USAGE_LIMITS_WARNING_THRESHOLD_PERCENT', '90');
    vi.stubEnv('DIAL_API_KEY', 'secret-api-key');
    const populated = generate();

    expect(populated).toEqual(clean);
    const text = JSON.stringify(populated);
    expect(text).not.toContain('Leaked title');
    expect(text).not.toContain('secret-api-key');
  });

  it('declares the 2020-12 dialect and a versioned URN id', () => {
    const schema = generate();
    expect(schema['$schema']).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
    expect(schema['$id']).toBe('urn:dial:chat-ui:managed-config:1.0.0');
    expect(managedConfigSchemaId('2.3.4')).toBe(
      'urn:dial:chat-ui:managed-config:2.3.4',
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

  it('exports exactly the 1.0.0 managed keys', () => {
    const schema = generate();
    expect(Object.keys(propertiesOf(schema, 'config'))).toEqual([
      'announcement.title',
      'announcement.description',
      'announcement.items',
      'welcomeScreen.description',
      'fileManager.availableTabs',
      'usageLimits.warningThresholdPercent',
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
      if (definition.managed !== true) {
        expect(exported.has(definition.key), definition.key).toBe(false);
      }
    }
  });

  it('emits Studio editor annotations', () => {
    const schema = generate();
    const title = propertiesOf(schema, 'config')[
      'announcement.title'
    ] as JsonSchemaObject;
    expect(title['title']).toBe('Announcement title');
    expect(title['dial:meta']).toEqual({ 'dial:propertyOrder': 10 });
    expect(title).not.toHaveProperty('isHidden');
    const feature = propertiesOf(schema, 'features')[
      'features.usageLimitsControl'
    ] as JsonSchemaObject;
    expect(feature['$ref']).toBe('#/$defs/featureState');
    expect(feature['title']).toBe('Usage-limits control');
  });

  it('emits isHidden only for a hidden key', () => {
    const hidden = CONFIG_DEFINITIONS.map((definition) =>
      definition.key === 'welcomeScreen.description' &&
      definition.managedContract
        ? {
            ...definition,
            managedContract: { ...definition.managedContract, isHidden: true },
          }
        : definition,
    );
    const schema = buildManagedConfigSchema(hidden, '1.0.0');
    expect(
      (
        propertiesOf(schema, 'config')[
          'welcomeScreen.description'
        ] as JsonSchemaObject
      )['isHidden'],
    ).toBe(true);
  });

  it('takes defaults only from the registry and omits null ones', () => {
    const config = propertiesOf(generate(), 'config');
    expect(
      (config['usageLimits.warningThresholdPercent'] as JsonSchemaObject)[
        'default'
      ],
    ).toBe(75);
    expect(
      (config['announcement.items'] as JsonSchemaObject)['default'],
    ).toEqual([]);
    expect(
      (config['fileManager.availableTabs'] as JsonSchemaObject)['default'],
    ).toEqual(['all', 'my_files', 'shared', 'organization']);
    expect(config['announcement.title']).not.toHaveProperty('default');
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
    expect(artifact.appId).toBe('chat-ui');
    const index = buildManagedConfigIndex([artifact]);
    expect(index).toMatchObject({
      format: 'dial-managed-config-schema-index@1',
      appId: 'chat-ui',
      current: '1.0.0',
      supported: SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS,
    });
    expect(index.versions).toEqual([
      {
        schemaVersion: '1.0.0',
        file: 'chat-ui-1.0.0.json',
        schemaSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        canonicalBytes: canonicalByteLength(artifact.schema),
      },
    ]);
  });

  it('orders index versions semantically', () => {
    const at = (version: string) => ({
      appId: 'chat-ui',
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
