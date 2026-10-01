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

  it('contains the fileManager.availableTabs entry with all listed first', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'fileManager.availableTabs',
    );

    expect(entry).toMatchObject({
      key: 'fileManager.availableTabs',
      type: 'config',
      valueType: 'json',
      visibility: 'client',
      defaultValue: ['all', 'my_files', 'shared', 'organization'],
      critical: false,
      envVar: 'FILE_MANAGER_AVAILABLE_TABS',
    });
  });

  it('contains the applicationVisualizers entry with the expected shape', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'applicationVisualizers',
    );

    expect(entry).toMatchObject({
      key: 'applicationVisualizers',
      type: 'config',
      valueType: 'json',
      visibility: 'client',
      defaultValue: {},
      critical: false,
      envVar: 'APPLICATION_VISUALIZERS',
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

  it('contains the features.responsesApiEnabled entry with server-only visibility and no role gating', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'features.responsesApiEnabled',
    );

    expect(entry).toMatchObject({
      key: 'features.responsesApiEnabled',
      type: 'feature',
      valueType: 'boolean',
      visibility: 'server',
      defaultValue: false,
      critical: false,
      envVar: 'RESPONSES_API_ENABLED',
    });
    expect(entry).not.toHaveProperty('allowedRolesEnvVar');
  });

  it('contains the features.responsesBackgroundEnabled entry with server-only visibility and no role gating', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'features.responsesBackgroundEnabled',
    );

    expect(entry).toMatchObject({
      key: 'features.responsesBackgroundEnabled',
      type: 'feature',
      valueType: 'boolean',
      visibility: 'server',
      defaultValue: false,
      critical: false,
      envVar: 'RESPONSES_BACKGROUND_ENABLED',
    });
    expect(entry).not.toHaveProperty('allowedRolesEnvVar');
  });

  it('contains the client-visible features.defaultDeploymentPinned entry', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'features.defaultDeploymentPinned',
    );

    expect(entry).toMatchObject({
      key: 'features.defaultDeploymentPinned',
      type: 'feature',
      valueType: 'boolean',
      visibility: 'client',
      defaultValue: false,
      critical: false,
      envVar: 'DEFAULT_DEPLOYMENT_PINNED',
    });
  });

  it('contains the client-visible features.visualizerSendMessages entry without role gating', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'features.visualizerSendMessages',
    );

    expect(entry).toMatchObject({
      key: 'features.visualizerSendMessages',
      type: 'feature',
      valueType: 'boolean',
      visibility: 'client',
      defaultValue: false,
      critical: false,
      envVar: 'ALLOW_VISUALIZER_SEND_MESSAGES',
    });
    expect(entry).not.toHaveProperty('allowedRolesEnvVar');
  });

  it('contains an open-ended client-visible event selection without a feature flag', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'ui.activeEventId',
    );

    expect(entry).toMatchObject({
      key: 'ui.activeEventId',
      type: 'config',
      valueType: 'string',
      visibility: 'client',
      defaultValue: null,
      critical: false,
      envVar: 'UI_EVENT',
    });
    expect(entry).not.toHaveProperty('allowedRolesEnvVar');
    expect(
      CONFIG_DEFINITIONS.some(
        (definition) => definition.key === 'features.halloweenEnabled',
      ),
    ).toBe(false);
  });
});
