import { getMetadataStorage } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { EnvironmentVariables } from '../../../config/environment.config';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';
import {
  LocalOnlyReason,
  ManagedSchemaType,
  type ManagedValueSchema,
} from '../../managed-config/managed-config.types';

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

  it('contains the content.additionalLocales entry with the expected shape', () => {
    const entry = CONFIG_DEFINITIONS.find(
      (definition) => definition.key === 'content.additionalLocales',
    );

    expect(entry).toMatchObject({
      key: 'content.additionalLocales',
      type: 'config',
      valueType: 'json',
      visibility: 'client',
      defaultValue: [],
      critical: false,
      owner: 'chat-team',
      envVar: 'ADDITIONAL_CONTENT_LOCALES',
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

/* Every name EnvironmentVariables declares, from its validation metadata. */
const ENVIRONMENT_VARIABLE_NAMES: readonly string[] = [
  ...new Set(
    getMetadataStorage()
      .getTargetValidationMetadatas(EnvironmentVariables, '', true, false)
      .map((metadata) => metadata.propertyName),
  ),
];

const MANAGED_1_0_0_KEYS = [
  'announcement.description',
  'announcement.items',
  'announcement.title',
  'features.usageLimitsControl',
  'fileManager.availableTabs',
  'usageLimits.warningThresholdPercent',
  'welcomeScreen.description',
];

/* Every string either has an upper length bound or an enum, and every array
 * an upper item bound, at every nesting level. */
const collectUnboundedNodes = (
  schema: ManagedValueSchema,
  path: string,
): string[] => {
  switch (schema.type) {
    case ManagedSchemaType.String:
      return 'enum' in schema || typeof schema.maxLength === 'number'
        ? []
        : [path];
    case ManagedSchemaType.Array:
      return [
        ...(typeof schema.maxItems === 'number' ? [] : [path]),
        ...collectUnboundedNodes(schema.items, `${path}/items`),
      ];
    case ManagedSchemaType.Object:
      return Object.entries(schema.properties).flatMap(([name, child]) =>
        collectUnboundedNodes(child, `${path}/${name}`),
      );
    default:
      return [];
  }
};

describe('CONFIG_DEFINITIONS managed classification', () => {
  it('classifies every key exactly once', () => {
    for (const definition of CONFIG_DEFINITIONS) {
      const classes = [
        definition.managed === true,
        definition.localOnly !== undefined,
      ].filter(Boolean);
      expect(classes.length, definition.key).toBeLessThanOrEqual(1);
    }
    const keys = CONFIG_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('declares exactly the 48 known keys: 7 managed, 27 local-only and 14 eligible', () => {
    expect(CONFIG_DEFINITIONS).toHaveLength(48);
    expect(CONFIG_DEFINITIONS.filter((d) => d.managed === true)).toHaveLength(
      7,
    );
    expect(
      CONFIG_DEFINITIONS.filter((d) => d.localOnly !== undefined),
    ).toHaveLength(27);
    expect(
      CONFIG_DEFINITIONS.filter(
        (d) => d.managed !== true && d.localOnly === undefined,
      ),
    ).toHaveLength(14);
  });

  it('gives every managed key a contract and never marks it local-only', () => {
    for (const definition of CONFIG_DEFINITIONS.filter(
      (d) => d.managed === true,
    )) {
      expect(definition.managedContract, definition.key).toBeDefined();
      expect(definition.localOnly, definition.key).toBeUndefined();
    }
  });

  it('gives a contract only to managed keys', () => {
    for (const definition of CONFIG_DEFINITIONS.filter(
      (d) => d.managed !== true,
    )) {
      expect(definition.managedContract, definition.key).toBeUndefined();
    }
  });

  it('declares a value schema for every managed config key and none for a feature', () => {
    for (const definition of CONFIG_DEFINITIONS.filter(
      (d) => d.managed === true,
    )) {
      if (definition.type === 'feature') {
        expect(
          definition.managedContract?.value,
          definition.key,
        ).toBeUndefined();
      } else {
        expect(definition.managedContract?.value, definition.key).toBeDefined();
      }
    }
  });

  it('declares a value schema for every managed json key', () => {
    const managedJson = CONFIG_DEFINITIONS.filter(
      (d) => d.managed === true && d.valueType === 'json',
    );
    expect(managedJson.length).toBeGreaterThan(0);
    for (const definition of managedJson) {
      expect(definition.managedContract?.value, definition.key).toBeDefined();
    }
  });

  it('bounds every managed string and array', () => {
    for (const definition of CONFIG_DEFINITIONS) {
      const value = definition.managedContract?.value;
      if (value) {
        expect(collectUnboundedNodes(value, definition.key)).toEqual([]);
      }
    }
  });

  it('keeps environment variable names out of operator descriptions', () => {
    expect(ENVIRONMENT_VARIABLE_NAMES.length).toBeGreaterThan(100);
    for (const definition of CONFIG_DEFINITIONS) {
      const contract = definition.managedContract;
      if (!contract) continue;
      const text = JSON.stringify(contract);
      for (const name of ENVIRONMENT_VARIABLE_NAMES) {
        expect(text.includes(name), `${definition.key} mentions ${name}`).toBe(
          false,
        );
      }
    }
  });

  it('manages exactly the seven 1.0.0 keys', () => {
    expect(
      CONFIG_DEFINITIONS.filter((d) => d.managed === true)
        .map((d) => d.key)
        .sort(),
    ).toEqual(MANAGED_1_0_0_KEYS);
  });

  it('gives every managed key in a section a distinct display order', () => {
    for (const type of ['config', 'feature'] as const) {
      const orders = CONFIG_DEFINITIONS.filter(
        (d) => d.managed === true && d.type === type,
      ).map((d) => d.managedContract?.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it.each([
    ['asr.modelId', LocalOnlyReason.Capability],
    ['features.asrEnabled', LocalOnlyReason.Capability],
    ['utility.modelId', LocalOnlyReason.Capability],
    ['features.llmConversationNaming', LocalOnlyReason.Capability],
    ['features.responsesApiEnabled', LocalOnlyReason.Capability],
    ['features.responsesBackgroundEnabled', LocalOnlyReason.Capability],
    ['dialCore.externalUrl', LocalOnlyReason.DeploymentTopology],
    ['mcpApps.sandboxUrl', LocalOnlyReason.DeploymentTopology],
    ['overlay.enabled', LocalOnlyReason.SecurityPolicy],
    ['overlay.allowedOrigins', LocalOnlyReason.SecurityPolicy],
    ['documents.allowedConnectOrigins', LocalOnlyReason.SecurityPolicy],
    ['customVisualizers', LocalOnlyReason.SecurityPolicy],
    ['applicationVisualizers', LocalOnlyReason.SecurityPolicy],
    ['features.visualizerSendMessages', LocalOnlyReason.SecurityPolicy],
    ['ui.celebrationDelivery.mode', LocalOnlyReason.SecurityPolicy],
    ['ui.celebrationDelivery.revision', LocalOnlyReason.SecurityPolicy],
    ['ui.celebrationDelivery.externalScenes', LocalOnlyReason.SecurityPolicy],
    ['ui.celebrationDelivery.externalEvents', LocalOnlyReason.SecurityPolicy],
    ['announcement.html', LocalOnlyReason.SecurityPolicy],
    ['asr.transcribeSizeLimitBytes', LocalOnlyReason.BackendEnforcedLimit],
    ['attachments.maxFileSizeBytes', LocalOnlyReason.BackendEnforcedLimit],
    ['projects.contextFileMaxBytes', LocalOnlyReason.BackendEnforcedLimit],
    ['projects.contextTotalMaxBytes', LocalOnlyReason.BackendEnforcedLimit],
    ['projects.contextAllowedExtensions', LocalOnlyReason.BackendEnforcedLimit],
    ['app.version', LocalOnlyReason.BuildMetadata],
    ['features.footer', LocalOnlyReason.Derived],
    ['customVariables', LocalOnlyReason.Opaque],
  ])('marks %s local-only as %s', (key, reason) => {
    expect(
      CONFIG_DEFINITIONS.find((definition) => definition.key === key)
        ?.localOnly,
    ).toBe(reason);
  });

  it.each([
    'features.scheduledTasksEnabled',
    'features.projectsEnabled',
    'footer.html',
    'uiFeatures.enabledUiFeatures',
  ])('keeps the excluded candidate %s eligible but unmanaged', (key) => {
    const definition = CONFIG_DEFINITIONS.find((entry) => entry.key === key);
    expect(definition?.managed).toBeUndefined();
    expect(definition?.localOnly).toBeUndefined();
  });

  it('never manages a key that reads DIAL_CORE_URL', () => {
    expect(
      CONFIG_DEFINITIONS.filter(
        (definition) =>
          definition.managed === true &&
          (definition.envVar === 'DIAL_CORE_URL' ||
            definition.allowedRolesEnvVar === 'DIAL_CORE_URL'),
      ),
    ).toEqual([]);
  });
});
