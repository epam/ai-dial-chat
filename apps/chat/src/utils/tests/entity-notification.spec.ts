import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { NotifiableEntity } from '../../types/entity-notification';
import {
  findSchemaDisplayName,
  resolveCatalogItemEntity,
} from '../entity-notification';

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

describe('resolveCatalogItemEntity', () => {
  it('names an app of the QuickApp schema a quick app', () => {
    expect(
      resolveCatalogItemEntity(
        CatalogEntityType.Agent,
        { applicationTypeSchemaId: 'https://example.com/schemas/quickapps2' },
        SCHEMAS,
      ),
    ).toBe(NotifiableEntity.QuickApp);
  });

  it('names an app a quick app when only its schema display name marks it as QuickApp', () => {
    expect(
      resolveCatalogItemEntity(
        CatalogEntityType.Agent,
        { applicationTypeSchemaId: 'https://example.com/schemas/renamed' },
        [
          {
            id: 'https://example.com/schemas/renamed',
            displayName: 'Quick app 2.0',
          },
        ],
      ),
    ).toBe(NotifiableEntity.QuickApp);
  });

  it('names an app of another known schema by that schema', () => {
    expect(
      resolveCatalogItemEntity(
        CatalogEntityType.Agent,
        { applicationTypeSchemaId: 'https://example.com/schemas/externalapps' },
        SCHEMAS,
      ),
    ).toBe(NotifiableEntity.SchemaApp);
  });

  it('falls back to the generic application copy when the schema is not loaded', () => {
    expect(
      resolveCatalogItemEntity(CatalogEntityType.Agent, {
        applicationTypeSchemaId: 'https://example.com/schemas/unknown',
      }),
    ).toBe(NotifiableEntity.Agent);
  });

  it('names a schema-less app a custom app', () => {
    expect(
      resolveCatalogItemEntity(CatalogEntityType.Agent, {
        applicationTypeSchemaId: null,
      }),
    ).toBe(NotifiableEntity.CustomApp);
  });

  it('falls back to the generic application copy when the deployment is unknown', () => {
    expect(resolveCatalogItemEntity(CatalogEntityType.Agent)).toBe(
      NotifiableEntity.Agent,
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
