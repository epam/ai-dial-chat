import { describe, expect, it } from 'vitest';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';

describe('CONFIG_DEFINITIONS', () => {
  it('contains the customVisualizers entry with the expected shape', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'customVisualizers',
    );

    expect(entry).toMatchObject({
      key: 'customVisualizers',
      type: 'config',
      valueType: 'json',
      visibility: 'client',
      defaultValue: [],
      critical: false,
      envVar: 'CUSTOM_VISUALIZERS',
    });
  });

  it('contains the publish.publicationFilterSources entry with the expected shape', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'publish.publicationFilterSources',
    );

    expect(entry).toMatchObject({
      key: 'publish.publicationFilterSources',
      type: 'config',
      valueType: 'json',
      visibility: 'client',
      defaultValue: ['title', 'role', 'dial_roles'],
      critical: false,
      envVar: 'PUBLICATION_FILTER_SOURCES',
    });
  });
});
