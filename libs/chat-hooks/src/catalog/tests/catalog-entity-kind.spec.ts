import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  CatalogEntityKind,
  findSchemaDisplayName,
  resolveCatalogEntityKind,
} from '../catalog-entity-kind';

const SCHEMAS = [
  {
    id: 'https://example.com/schemas/quickapps2',
    displayName: 'Quick app 2.0',
  },
  {
    id: 'https://example.com/schemas/externalapps',
    displayName: 'External app',
  },
];

describe('resolveCatalogEntityKind', () => {
  it('names an app of the QuickApp schema a quick app', () => {
    expect(
      resolveCatalogEntityKind(
        CatalogEntityType.Agent,
        { applicationTypeSchemaId: 'https://example.com/schemas/quickapps2' },
        SCHEMAS,
      ),
    ).toBe(CatalogEntityKind.QuickApp);
  });

  it('names an app a quick app when only its schema display name marks it as QuickApp', () => {
    expect(
      resolveCatalogEntityKind(
        CatalogEntityType.Agent,
        { applicationTypeSchemaId: 'https://example.com/schemas/renamed' },
        [
          {
            id: 'https://example.com/schemas/renamed',
            displayName: 'Quick app 2.0',
          },
        ],
      ),
    ).toBe(CatalogEntityKind.QuickApp);
  });

  it('names an app of another known schema by that schema', () => {
    expect(
      resolveCatalogEntityKind(
        CatalogEntityType.Agent,
        { applicationTypeSchemaId: 'https://example.com/schemas/externalapps' },
        SCHEMAS,
      ),
    ).toBe(CatalogEntityKind.SchemaApp);
  });

  it('falls back to the generic application kind when the schema is not loaded', () => {
    expect(
      resolveCatalogEntityKind(CatalogEntityType.Agent, {
        applicationTypeSchemaId: 'https://example.com/schemas/unknown',
      }),
    ).toBe(CatalogEntityKind.Agent);
  });

  it('names a schema-less app a custom app', () => {
    expect(
      resolveCatalogEntityKind(CatalogEntityType.Agent, {
        applicationTypeSchemaId: null,
      }),
    ).toBe(CatalogEntityKind.CustomApp);
  });

  it('maps non-application catalog types one to one', () => {
    expect(resolveCatalogEntityKind(CatalogEntityType.Model)).toBe(
      CatalogEntityKind.Model,
    );
    expect(resolveCatalogEntityKind(CatalogEntityType.Prompt)).toBe(
      CatalogEntityKind.Prompt,
    );
  });

  it('falls back to the generic application kind when the deployment is unknown', () => {
    expect(resolveCatalogEntityKind(CatalogEntityType.Agent)).toBe(
      CatalogEntityKind.Agent,
    );
  });
});

describe('findSchemaDisplayName', () => {
  it('returns the display name of a loaded schema', () => {
    expect(
      findSchemaDisplayName(
        SCHEMAS,
        'https://example.com/schemas/externalapps',
      ),
    ).toBe('External app');
  });

  it('returns undefined for a missing or unknown schema id', () => {
    expect(findSchemaDisplayName(SCHEMAS, undefined)).toBeUndefined();
    expect(findSchemaDisplayName(SCHEMAS, 'unknown')).toBeUndefined();
  });
});
