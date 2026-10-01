import { describe, expect, it } from 'vitest';
import { ApplicationEditorKind } from '../../types/application-editor';
import { NotifiableEntity } from '../../types/entity-notification';
import {
  getMissingRequiredProperties,
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
  it('returns required names whose value is absent, null, blank or an empty array', () => {
    expect(
      getMissingRequiredProperties(
        { blank: '  ', empty: [], nil: null, filled: 'x', zero: 0, off: false },
        ['absent', 'blank', 'empty', 'nil', 'filled', 'zero', 'off'],
      ),
    ).toEqual(['absent', 'blank', 'empty', 'nil']);
  });

  it('treats every required name as missing when there are no properties yet', () => {
    expect(getMissingRequiredProperties(undefined, ['a'])).toEqual(['a']);
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
