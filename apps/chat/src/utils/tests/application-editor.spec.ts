import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import { describe, expect, it } from 'vitest';
import { ApplicationEditorKind } from '../../types/application-editor';
import { NotifiableEntity } from '../../types/entity-notification';
import {
  getMissingRequiredProperties,
  getSchemaTopLevelDefaults,
  hasVisibleSchemaProperties,
  resolveSchemaEditorKind,
  resolveSchemaNotificationTarget,
  toApplicationMetadataFields,
  toLocaleFields,
} from '../application-editor';

describe('resolveSchemaEditorKind', () => {
  const schemas = [
    { id: 'with-editor', editorUrl: 'https://editor.example' },
    { id: 'form-only', properties: { prompt: { type: 'string' } } },
    { id: 'bare', properties: {} },
  ];

  it('uses the schema form for a schema without an editor URL', () => {
    expect(resolveSchemaEditorKind(schemas, 'form-only')).toBe(
      ApplicationEditorKind.SchemaApp,
    );
  });

  it('keeps the embedded editor for a schema with an editor URL', () => {
    expect(resolveSchemaEditorKind(schemas, 'with-editor')).toBe(
      ApplicationEditorKind.QuickApp,
    );
  });

  it('uses the schema form for an editor-less schema even without properties', () => {
    expect(resolveSchemaEditorKind(schemas, 'bare')).toBe(
      ApplicationEditorKind.SchemaApp,
    );
  });

  it('keeps the embedded editor while the schema is unknown', () => {
    expect(resolveSchemaEditorKind(schemas, null)).toBe(
      ApplicationEditorKind.QuickApp,
    );
  });
});

describe('getMissingRequiredProperties', () => {
  /* The same rule SchemaRenderer highlights a required field by. */
  it('returns required names whose value is absent, null or an empty string', () => {
    expect(
      getMissingRequiredProperties(
        {
          empty: '',
          nil: null,
          blank: '  ',
          list: [],
          filled: 'x',
          zero: 0,
          off: false,
        },
        ['absent', 'empty', 'nil', 'blank', 'list', 'filled', 'zero', 'off'],
      ),
    ).toEqual(['absent', 'empty', 'nil']);
  });

  it('treats every required name as missing when there are no properties yet', () => {
    expect(getMissingRequiredProperties(undefined, ['a'])).toEqual(['a']);
  });
});

describe('getSchemaTopLevelDefaults', () => {
  it('returns the default of every top-level property that declares one', () => {
    expect(
      getSchemaTopLevelDefaults({
        type: 'object',
        properties: {
          threshold: { type: 'number', default: 0.5 },
          strict: { type: 'boolean', default: false },
          labels: { type: 'string' },
        },
      }),
    ).toEqual({ threshold: 0.5, strict: false });
  });

  it('returns no defaults for a schema without properties', () => {
    expect(getSchemaTopLevelDefaults({ type: 'object' })).toEqual({});
  });
});

describe('resolveSchemaNotificationTarget', () => {
  const t = ((key: string) => key) as never;
  const contextFor = (schemaId: string) => ({
    searchParams: new URLSearchParams({ schema: schemaId }),
    schemas: [
      {
        id: 'https://example.com/schemas/quickapps2',
        displayName: 'Quick app 2.0',
      },
      {
        id: 'https://example.com/schemas/externalapps',
        displayName: 'External app',
      },
    ],
    t,
  });

  it('notifies about a quick app for the QuickApp schema', () => {
    expect(
      resolveSchemaNotificationTarget(
        contextFor('https://example.com/schemas/quickapps2'),
      ),
    ).toEqual({ entity: NotifiableEntity.QuickApp });
  });

  it('names any other known schema by its display name', () => {
    expect(
      resolveSchemaNotificationTarget(
        contextFor('https://example.com/schemas/externalapps'),
      ),
    ).toEqual({ entity: NotifiableEntity.SchemaApp, type: 'External app' });
  });

  it('falls back to the generic application copy for an unknown schema', () => {
    expect(
      resolveSchemaNotificationTarget(
        contextFor('https://example.com/schemas/unknown'),
      ),
    ).toEqual({ entity: NotifiableEntity.Agent });
  });
});

describe('hasVisibleSchemaProperties', () => {
  it('is false for a schema without properties', () => {
    expect(hasVisibleSchemaProperties({ properties: {} })).toBe(false);
    expect(hasVisibleSchemaProperties({ type: 'object' })).toBe(false);
  });

  it('is true when a top-level property is shown', () => {
    expect(
      hasVisibleSchemaProperties({
        properties: { prompt: { type: 'string' } },
      }),
    ).toBe(true);
  });

  it('ignores properties hidden directly or through their $ref', () => {
    expect(
      hasVisibleSchemaProperties({
        properties: {
          token: { type: 'string', isHidden: true },
          internal: { $ref: '#/$defs/Internal' },
        },
        $defs: { Internal: { type: 'object', isHidden: true } },
      }),
    ).toBe(false);
  });
});

const makeMetadata = (
  overrides: Partial<DeploymentCreationFormValues> = {},
): DeploymentCreationFormValues => ({
  name: ' My App ',
  description: ' About ',
  iconUrl: ' files/b/icon.png ',
  version: ' 1.0.0 ',
  topics: ['a', 'b'],
  otherLocales: [],
  ...overrides,
});

describe('toLocaleFields', () => {
  it('leaves both fields out when there are no additional locales', () => {
    expect(toLocaleFields(makeMetadata())).toEqual({
      locales: undefined,
      primaryLocale: undefined,
    });
  });

  it('pairs the composed locales with the primary locale', () => {
    const fields = toLocaleFields(
      makeMetadata({
        otherLocales: [
          { id: 'l1', language: 'de', name: 'Name DE', description: '' },
        ],
      }),
    );
    expect(fields.locales).toEqual([
      { language: 'de', name: 'Name DE', description: undefined },
    ]);
    expect(fields.primaryLocale).toBe('en');
  });
});

describe('toApplicationMetadataFields', () => {
  it('trims name, description, icon and version', () => {
    expect(toApplicationMetadataFields(makeMetadata())).toEqual({
      name: 'My App',
      description: 'About',
      iconUrl: 'files/b/icon.png',
      version: '1.0.0',
      topics: ['a', 'b'],
      locales: undefined,
      primaryLocale: undefined,
    });
  });

  it('leaves out a description, icon and version that are blank', () => {
    const fields = toApplicationMetadataFields(
      makeMetadata({ description: '  ', iconUrl: '', version: ' ' }),
    );
    expect(fields.description).toBeUndefined();
    expect(fields.iconUrl).toBeUndefined();
    expect(fields.version).toBeUndefined();
  });

  it('sends an empty topics list by default', () => {
    expect(
      toApplicationMetadataFields(makeMetadata({ topics: [] })).topics,
    ).toEqual([]);
  });

  it('leaves empty topics out when asked to', () => {
    const options = { shouldOmitEmptyTopics: true };
    expect(
      toApplicationMetadataFields(makeMetadata({ topics: [] }), options).topics,
    ).toBeUndefined();
    expect(toApplicationMetadataFields(makeMetadata(), options).topics).toEqual(
      ['a', 'b'],
    );
  });

  it('includes the locale fields', () => {
    const fields = toApplicationMetadataFields(
      makeMetadata({
        otherLocales: [
          { id: 'l1', language: 'fr', name: 'Nom', description: 'D' },
        ],
      }),
    );
    expect(fields.locales).toEqual([
      { language: 'fr', name: 'Nom', description: 'D' },
    ]);
    expect(fields.primaryLocale).toBe('en');
  });
});
