import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';
import {
  canonicalByteLength,
  canonicalSha256,
} from '../../managed-config/canonical-json';
import {
  buildManagedConfigArtifact,
  buildManagedConfigIndex,
  compareSchemaVersions,
  managedConfigArtifactFileName,
  type ManagedConfigArtifact,
  type ManagedConfigIndex,
} from '../../managed-config/managed-config-artifact';
import {
  MANAGED_CONFIG_SCHEMA_VERSION,
  MAX_MANAGED_SCHEMA_BYTES,
  PINNED_MANAGED_CONFIG_SCHEMA_SHA256,
  SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS,
} from '../../managed-config/managed-config.constants';
import {
  VersionBump,
  classifyBump,
  findVersionBumpViolations,
} from './schema-compatibility.fixtures';

/*
 * Ties the committed artifacts in apps/chat-api/managed-config-schema to the
 * registry. A pinned version is never edited: regenerate with
 * `npm run managed-config-schema` after a registry change, bump
 * MANAGED_CONFIG_SCHEMA_VERSION when the contract changes, and pin the new
 * version's hash by hand.
 */
const ARTIFACT_DIRECTORY = join(__dirname, '../../../../managed-config-schema');
const FIXTURE_DIRECTORY = join(__dirname, 'fixtures');

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;

const committedArtifactFiles = readdirSync(ARTIFACT_DIRECTORY)
  .filter((file) => /^chat-ui-.+\.json$/.test(file))
  .sort();
const committedArtifacts = committedArtifactFiles.map((file) =>
  readJson<ManagedConfigArtifact>(join(ARTIFACT_DIRECTORY, file)),
);
const index = readJson<ManagedConfigIndex>(
  join(ARTIFACT_DIRECTORY, 'index.json'),
);

const readValidFixtures = (schemaVersion: string): unknown[] => {
  const file = join(
    FIXTURE_DIRECTORY,
    `chat-ui-${schemaVersion}.fixtures.json`,
  );
  return readJson<{ valid: { payload: unknown }[] }>(file).valid.map(
    (fixture) => fixture.payload,
  );
};

describe('committed managed-config artifacts', () => {
  it('commits the current version', () => {
    expect(committedArtifactFiles).toContain(
      managedConfigArtifactFileName(MANAGED_CONFIG_SCHEMA_VERSION),
    );
  });

  it('keeps the current version equal to the generator output', () => {
    const committed = readJson<unknown>(
      join(
        ARTIFACT_DIRECTORY,
        managedConfigArtifactFileName(MANAGED_CONFIG_SCHEMA_VERSION),
      ),
    );
    expect(committed).toEqual(
      buildManagedConfigArtifact(
        CONFIG_DEFINITIONS,
        MANAGED_CONFIG_SCHEMA_VERSION,
      ),
    );
  });

  it('stores exactly the upload fields in every artifact, under its own name', () => {
    committedArtifacts.forEach((artifact, position) => {
      expect(Object.keys(artifact).sort()).toEqual([
        'appId',
        'schema',
        'schemaVersion',
      ]);
      expect(artifact.appId).toBe('chat-ui');
      expect(committedArtifactFiles[position]).toBe(
        managedConfigArtifactFileName(artifact.schemaVersion),
      );
    });
  });

  it('hashes every committed version to its index entry', () => {
    for (const artifact of committedArtifacts) {
      const entry = index.versions.find(
        (version) => version.schemaVersion === artifact.schemaVersion,
      );
      expect(entry, artifact.schemaVersion).toBeDefined();
      expect(entry?.schemaSha256).toBe(canonicalSha256(artifact.schema));
      expect(entry?.canonicalBytes).toBe(canonicalByteLength(artifact.schema));
    }
  });

  it('pins every committed version to its hand-written hash', () => {
    expect(
      Object.fromEntries(
        index.versions.map((entry) => [
          entry.schemaVersion,
          entry.schemaSha256,
        ]),
      ),
    ).toEqual(PINNED_MANAGED_CONFIG_SCHEMA_SHA256);
  });

  it('lists exactly the committed files in the index', () => {
    expect(index.versions.map((entry) => entry.file).sort()).toEqual(
      committedArtifactFiles,
    );
  });

  it('names the highest version as current', () => {
    const highest = [...index.versions]
      .map((entry) => entry.schemaVersion)
      .sort(compareSchemaVersions)
      .pop();
    expect(index.current).toBe(highest);
    expect(index.current).toBe(MANAGED_CONFIG_SCHEMA_VERSION);
  });

  it('declares the supported versions of this build', () => {
    expect(index.supported).toEqual(SUPPORTED_MANAGED_CONFIG_SCHEMA_VERSIONS);
  });

  it('equals the index regenerated from the committed artifacts', () => {
    expect(index).toEqual(buildManagedConfigIndex(committedArtifacts));
  });

  it('keeps every version within the Studio size limit', () => {
    for (const entry of index.versions) {
      expect(entry.canonicalBytes).toBeLessThanOrEqual(
        MAX_MANAGED_SCHEMA_BYTES,
      );
    }
  });

  it('follows the bump rules between consecutive committed versions', () => {
    const sorted = [...committedArtifacts].sort((left, right) =>
      compareSchemaVersions(left.schemaVersion, right.schemaVersion),
    );
    for (let position = 1; position < sorted.length; position += 1) {
      const previous = sorted[position - 1];
      expect(
        findVersionBumpViolations(
          previous,
          sorted[position],
          readValidFixtures(previous.schemaVersion),
        ),
      ).toEqual([]);
    }
  });
});

describe('version bump rules', () => {
  const base = {
    type: 'object',
    additionalProperties: false,
    required: ['config', 'features'],
    properties: {
      config: {
        type: 'object',
        additionalProperties: false,
        properties: {
          'announcement.title': {
            type: 'string',
            maxLength: 200,
            title: 'Announcement title',
            description: 'Old text',
          },
          'welcomeScreen.description': { type: 'string', maxLength: 1000 },
        },
      },
      features: { type: 'object', additionalProperties: false, properties: {} },
    },
    $defs: {
      featureState: {
        type: 'object',
        additionalProperties: false,
        required: ['enabled'],
        properties: { enabled: { type: 'boolean' } },
      },
    },
  };
  const at = (schemaVersion: string, schema: object) => ({
    schemaVersion,
    schema,
  });
  const withTitle = (change: Record<string, unknown>) => ({
    ...base,
    properties: {
      ...base.properties,
      config: {
        ...base.properties.config,
        properties: {
          ...base.properties.config.properties,
          'announcement.title': {
            ...base.properties.config.properties['announcement.title'],
            ...change,
          },
        },
      },
    },
  });
  const validFixtures = [
    { config: { 'announcement.title': 'x'.repeat(150) }, features: {} },
  ];

  it('classifies bumps', () => {
    expect(classifyBump('1.0.0', '1.0.1')).toBe(VersionBump.Patch);
    expect(classifyBump('1.0.0', '1.1.0')).toBe(VersionBump.Minor);
    expect(classifyBump('1.2.3', '2.0.0')).toBe(VersionBump.Major);
    expect(classifyBump('1.0.0', '1.0.0')).toBe(VersionBump.None);
    expect(classifyBump('1.1.0', '1.0.9')).toBe(VersionBump.None);
  });

  it('accepts an annotation-only change under a PATCH bump', () => {
    expect(
      findVersionBumpViolations(
        at('1.0.0', base),
        at('1.0.1', withTitle({ description: 'New text' })),
        validFixtures,
      ),
    ).toEqual([]);
  });

  it('rejects a validity change under a PATCH bump', () => {
    expect(
      findVersionBumpViolations(
        at('1.0.0', base),
        at('1.0.1', withTitle({ maxLength: 300 })),
        validFixtures,
      ),
    ).toEqual([
      'a change outside annotation keywords needs at least a MINOR bump',
    ]);
  });

  it('accepts a widened bound under a MINOR bump', () => {
    expect(
      findVersionBumpViolations(
        at('1.0.0', base),
        at('1.1.0', withTitle({ maxLength: 300 })),
        validFixtures,
      ),
    ).toEqual([]);
  });

  it('rejects a narrowed bound under a MINOR bump through the previous fixtures', () => {
    expect(
      findVersionBumpViolations(
        at('1.0.0', base),
        at('1.1.0', withTitle({ maxLength: 100 })),
        validFixtures,
      ),
    ).toEqual(['previous valid fixture 0 is rejected under 1.1.0']);
  });

  it('rejects a removed key under a MINOR bump and accepts it under MAJOR', () => {
    const removed = {
      ...base,
      properties: {
        ...base.properties,
        config: {
          ...base.properties.config,
          properties: {
            'announcement.title':
              base.properties.config.properties['announcement.title'],
          },
        },
      },
    };
    expect(
      findVersionBumpViolations(at('1.0.0', base), at('1.1.0', removed), []),
    ).toEqual([
      'removed /properties/config/properties/welcomeScreen.description needs a MAJOR bump',
    ]);
    expect(
      findVersionBumpViolations(at('1.0.0', base), at('2.0.0', removed), []),
    ).toEqual([]);
  });

  it('rejects a newly required member under a MINOR bump', () => {
    const required = {
      ...base,
      properties: {
        ...base.properties,
        config: { ...base.properties.config, required: ['announcement.title'] },
      },
    };
    expect(
      findVersionBumpViolations(at('1.0.0', base), at('1.1.0', required), []),
    ).toEqual([
      'newly required /properties/config/required/announcement.title needs a MAJOR bump',
    ]);
  });

  it('rejects a new feature-policy member under a MINOR bump', () => {
    const policy = {
      ...base,
      $defs: {
        featureState: {
          ...base.$defs.featureState,
          properties: {
            ...base.$defs.featureState.properties,
            percentage: { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
      },
    };
    expect(
      findVersionBumpViolations(at('1.0.0', base), at('1.1.0', policy), []),
    ).toEqual([
      'new feature-policy member /$defs/featureState/properties/percentage needs a MAJOR bump',
    ]);
  });

  it('accepts a new optional key under a MINOR bump', () => {
    const added = {
      ...base,
      properties: {
        ...base.properties,
        config: {
          ...base.properties.config,
          properties: {
            ...base.properties.config.properties,
            'footer.text': { type: 'string', maxLength: 100 },
          },
        },
      },
    };
    expect(
      findVersionBumpViolations(
        at('1.0.0', base),
        at('1.1.0', added),
        validFixtures,
      ),
    ).toEqual([]);
  });

  it('rejects a version that does not increase', () => {
    expect(
      findVersionBumpViolations(at('1.1.0', base), at('1.0.0', base), []),
    ).toEqual(['1.0.0 is not higher than 1.1.0']);
  });
});
