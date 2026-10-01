import { describe, expect, it } from 'vitest';
import { ApplicationEditorKind } from '../../types/application-editor';
import { NotifiableEntity } from '../../types/entity-notification';
import {
  getMissingRequiredProperties,
  getSchemaTopLevelDefaults,
  resolveSchemaEditorKind,
  resolveSchemaNotificationTarget,
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
  /* The same rule DialSchemaRenderer highlights a required field by. */
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
