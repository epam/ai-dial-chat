import { describe, expect, it } from 'vitest';
import type { ApplicationEditorContext } from '../../../models/application-editor';
import { AppsEditorQuery } from '../../../types/apps-editor';
import { customAppDefinition } from '../definitions/customAppDefinition';
import { quickAppDefinition } from '../definitions/quickAppDefinition';
import { schemaAppDefinition } from '../definitions/schemaAppDefinition';

const makeContext = (schemaId?: string): ApplicationEditorContext =>
  ({
    searchParams: new URLSearchParams(
      schemaId ? { [AppsEditorQuery.Schema]: schemaId } : {},
    ),
    schemas: [],
    t: ((key: string) => key) as never,
  }) as ApplicationEditorContext;

describe('save panel dependency values', () => {
  const getValues = schemaAppDefinition.savePanel?.getDependencyValues;

  it('gives a schema app the schema id and the form values', () => {
    const properties = { skills: [{ url: 'prompts/b/Hi' }] };

    expect(
      getValues?.(
        { properties, requiredProperties: [] },
        makeContext('https://schema/form'),
      ),
    ).toEqual({ schemaId: 'https://schema/form', properties });
  });

  it('gives nothing while the form holds no values or the schema is unknown', () => {
    expect(
      getValues?.({ requiredProperties: [] }, makeContext('https://schema/x')),
    ).toBeUndefined();
    expect(
      getValues?.(
        { properties: { a: 1 }, requiredProperties: [] },
        makeContext(),
      ),
    ).toBeUndefined();
  });

  it('is offered by no other kind', () => {
    expect(quickAppDefinition.savePanel?.getDependencyValues).toBeUndefined();
    expect(customAppDefinition.savePanel?.getDependencyValues).toBeUndefined();
  });
});

describe('save panel embedded form state flag', () => {
  it('is set by the Quick App, whose form state lives in an embedded editor', () => {
    expect(quickAppDefinition.savePanel?.isFormStateEmbedded).toBe(true);
  });

  it('is not set by the schema-form and custom kinds', () => {
    expect(schemaAppDefinition.savePanel?.isFormStateEmbedded).toBeUndefined();
    expect(customAppDefinition.savePanel?.isFormStateEmbedded).toBeUndefined();
  });
});
