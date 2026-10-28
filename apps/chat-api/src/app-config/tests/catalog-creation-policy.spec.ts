import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_CREATION_TYPES,
  CatalogCreationType,
  type CatalogCreationRolesConfig,
} from '../../config/catalog-creation.types';
import {
  evaluateCatalogCreationPolicy,
  normalizeCatalogCreationPolicy,
} from '../catalog-creation-policy';

const evaluate = (
  config: CatalogCreationRolesConfig | undefined,
  roles?: string[],
) =>
  evaluateCatalogCreationPolicy(
    normalizeCatalogCreationPolicy(config, vi.fn()),
    roles,
  );

describe('normalizeCatalogCreationPolicy', () => {
  it('trims roles, drops blanks, and deduplicates in first-occurrence order', () => {
    const policy = normalizeCatalogCreationPolicy(
      { types: { skill: [' b ', 'a', '', 'b', '  '] } },
      vi.fn(),
    );

    expect([...(policy.types.get(CatalogCreationType.Skill) ?? [])]).toEqual([
      'b',
      'a',
    ]);
  });

  it('preserves schema ids exactly and in configuration order', () => {
    const ids = [' Schema-B/', 'https://example.test/a%2Fb', 'schema-a'];
    const policy = normalizeCatalogCreationPolicy(
      { schemas: Object.fromEntries(ids.map((id) => [id, ['r']])) },
      vi.fn(),
    );

    expect([...policy.schemas.keys()]).toEqual(ids);
  });

  it('drops empty rules and warns once without role names or schema ids', () => {
    const warn = vi.fn();
    const policy = normalizeCatalogCreationPolicy(
      {
        types: { skill: ['  '], prompt: [], toolset: ['secret-role'] },
        schemas: { 'private-schema': [''], other: [] },
      },
      warn,
    );

    expect(policy.types.has(CatalogCreationType.Skill)).toBe(false);
    expect(policy.types.has(CatalogCreationType.Prompt)).toBe(false);
    expect(policy.schemas.size).toBe(0);
    expect(warn).toHaveBeenCalledOnce();
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('prompt');
    expect(message).toContain('skill');
    expect(message).toContain('2 schema rule(s)');
    expect(message).not.toContain('secret-role');
    expect(message).not.toContain('private-schema');
  });

  it('does not warn when every rule restricts', () => {
    const warn = vi.fn();
    normalizeCatalogCreationPolicy(
      { types: { skill: ['a'] }, schemas: { s: ['b'] } },
      warn,
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not mutate its input', () => {
    const config = {
      types: { skill: [' a ', 'a'] },
      schemas: { s: [' b '] },
    };
    const snapshot = structuredClone(config);
    normalizeCatalogCreationPolicy(config, vi.fn());

    expect(config).toEqual(snapshot);
  });

  it('treats an absent policy as empty', () => {
    const policy = normalizeCatalogCreationPolicy(undefined, vi.fn());

    expect(policy.types.size).toBe(0);
    expect(policy.schemas.size).toBe(0);
  });
});

describe('evaluateCatalogCreationPolicy', () => {
  it.each([undefined, {}, { types: {}, schemas: {} }])(
    'allows every type with no restricted schemas for %j',
    (config) => {
      expect(evaluate(config, ['any'])).toEqual({
        allowedTypes: [...CATALOG_CREATION_TYPES],
        restrictedSchemaIds: [],
      });
    },
  );

  it('reports allowed types in the fixed order', () => {
    expect(
      evaluate(
        { types: { skill: ['s'], 'custom-app': ['c'], toolset: ['t'] } },
        ['t', 's', 'c'],
      ).allowedTypes,
    ).toEqual([
      CatalogCreationType.CustomApp,
      CatalogCreationType.SchemaApp,
      CatalogCreationType.Toolset,
      CatalogCreationType.Prompt,
      CatalogCreationType.Skill,
    ]);
  });

  it('passes a rule when the user holds any listed role', () => {
    const config = { schemas: { 'schema-A': ['team-A', 'admins'] } };

    expect(evaluate(config, ['admins']).restrictedSchemaIds).toEqual([]);
    expect(evaluate(config, ['team-B']).restrictedSchemaIds).toEqual([
      'schema-A',
    ]);
  });

  it('keeps the schema-app type when only one schema is restricted', () => {
    const result = evaluate({ schemas: { 'schema-A': ['team-A'] } }, []);

    expect(result.allowedTypes).toContain(CatalogCreationType.SchemaApp);
    expect(result.restrictedSchemaIds).toEqual(['schema-A']);
  });

  it('reports schema denials independently of a denied schema-app type', () => {
    const config = {
      types: { 'schema-app': ['authors'] },
      schemas: { 'schema-A': ['team-A'] },
    };

    expect(evaluate(config, ['team-A'])).toEqual({
      allowedTypes: CATALOG_CREATION_TYPES.filter(
        (type) => type !== CatalogCreationType.SchemaApp,
      ),
      restrictedSchemaIds: [],
    });
    expect(evaluate(config, ['authors'])).toEqual({
      allowedTypes: [...CATALOG_CREATION_TYPES],
      restrictedSchemaIds: ['schema-A'],
    });
  });

  it('evaluates an anonymous request with no roles', () => {
    expect(evaluate({ types: { prompt: ['authors'] } })).toEqual({
      allowedTypes: CATALOG_CREATION_TYPES.filter(
        (type) => type !== CatalogCreationType.Prompt,
      ),
      restrictedSchemaIds: [],
    });
  });

  it('gives an administrator role no implicit exception', () => {
    expect(
      evaluate({ types: { skill: ['trainers'] } }, ['admin']).allowedTypes,
    ).not.toContain(CatalogCreationType.Skill);
  });

  it('matches roles case-sensitively after trimming configured entries', () => {
    const config = { types: { skill: [' Trainers '] } };

    expect(evaluate(config, ['Trainers']).allowedTypes).toContain(
      CatalogCreationType.Skill,
    );
    expect(evaluate(config, ['trainers']).allowedTypes).not.toContain(
      CatalogCreationType.Skill,
    );
  });

  it('keeps case- and punctuation-distinct schema ids apart', () => {
    const result = evaluate(
      {
        schemas: {
          'https://example.test/schemas/Runner-A': ['team-A'],
          'https://example.test/schemas/runner-a': ['team-a'],
        },
      },
      ['team-a'],
    );

    expect(result.restrictedSchemaIds).toEqual([
      'https://example.test/schemas/Runner-A',
    ]);
  });

  it('reports a configured schema that no deployment currently offers', () => {
    expect(
      evaluate({ schemas: { 'not-deployed-yet': ['team'] } }, [])
        .restrictedSchemaIds,
    ).toEqual(['not-deployed-yet']);
  });

  it('leaves an empty rule unrestricted', () => {
    expect(evaluate({ types: { skill: ['  '] } }, []).allowedTypes).toContain(
      CatalogCreationType.Skill,
    );
  });
});
