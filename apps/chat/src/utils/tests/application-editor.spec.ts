import { describe, expect, it } from 'vitest';
import { ApplicationEditorKind } from '../../types/application-editor';
import {
  getMissingRequiredProperties,
  resolveSchemaEditorKind,
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
