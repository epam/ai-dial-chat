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

  it('contains the client-visible ui.celebrationsEnabledByDefault config entry, on by default', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'ui.celebrationsEnabledByDefault',
    );

    expect(entry).toMatchObject({
      key: 'ui.celebrationsEnabledByDefault',
      type: 'config',
      valueType: 'boolean',
      visibility: 'client',
      defaultValue: true,
      critical: false,
      envVar: 'UI_EVENT_ENABLED_BY_DEFAULT',
    });
    expect(entry).not.toHaveProperty('allowedRolesEnvVar');
  });

  it('contains the client-visible features.usageLimitsControl entry, off by default', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'features.usageLimitsControl',
    );

    expect(entry).toMatchObject({
      key: 'features.usageLimitsControl',
      type: 'feature',
      valueType: 'boolean',
      visibility: 'client',
      defaultValue: false,
      critical: false,
      envVar: 'USAGE_LIMITS_CONTROL_ENABLED',
    });
  });

  it('contains the client-visible, role-gated features.projectsEnabled entry, off by default', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'features.projectsEnabled',
    );

    expect(entry).toMatchObject({
      key: 'features.projectsEnabled',
      type: 'feature',
      valueType: 'boolean',
      visibility: 'client',
      defaultValue: false,
      critical: false,
      envVar: 'PROJECTS_ENABLED',
      allowedRolesEnvVar: 'PROJECTS_ENABLED_ROLES',
    });
  });

  it.each([
    [
      'projects.contextFileMaxBytes',
      'number',
      1_048_576,
      'PROJECT_CONTEXT_FILE_MAX_BYTES',
    ],
    [
      'projects.contextTotalMaxBytes',
      'number',
      10_485_760,
      'PROJECT_CONTEXT_TOTAL_MAX_BYTES',
    ],
    [
      'projects.contextAllowedExtensions',
      'json',
      ['csv', 'pdf', 'xlsx'],
      'PROJECT_CONTEXT_ALLOWED_EXTENSIONS',
    ],
  ])(
    'contains the client-visible %s entry backed by the variable POST /api/v1/projects enforces',
    (key, valueType, defaultValue, envVar) => {
      const entry = CONFIG_DEFINITIONS.find(
        (definition) => definition.key === key,
      );

      expect(entry).toMatchObject({
        key,
        type: 'config',
        valueType,
        visibility: 'client',
        defaultValue,
        critical: false,
        owner: 'chat-team',
        envVar,
      });
    },
  );

  it('contains the client-visible usageLimits.warningThresholdPercent entry, 75 by default', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'usageLimits.warningThresholdPercent',
    );

    expect(entry).toMatchObject({
      key: 'usageLimits.warningThresholdPercent',
      type: 'config',
      valueType: 'number',
      visibility: 'client',
      defaultValue: 75,
      critical: false,
      owner: 'chat-team',
      envVar: 'USAGE_LIMITS_WARNING_THRESHOLD_PERCENT',
    });
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
