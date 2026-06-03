import {
  Defaults,
  DefaultsService,
} from '@/src/utils/app/data/defaults-service';
import { getTopicColors } from '@/src/utils/app/style-helpers';
import {
  ApiUtils,
  getMarketplaceEntityApiKey,
  parseEntityApiKey,
} from '@/src/utils/server/api';
import { ServerUtils } from '@/src/utils/server/server';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApiApplicationModel,
  ApiApplicationModelBase,
  ApiApplicationModelSchema,
  ApiApplicationResponse,
  ApplicationInfo,
  ApplicationStatus,
  ApplicationType,
  CustomApplicationModel,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { EntityType, PartialBy } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityFeatures, DialAIEntityModel } from '@/src/types/models';
import {
  DialAppToolset,
  DialDeploymentSimpleTool,
  MCPToolset,
  QuickApp2Config,
  QuickAppConfig,
} from '@/src/types/quick-apps';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { DESCRIPTION_DELIMITER_REGEX } from '@/src/constants/chat';
import {
  DEFAULT_APPLICATION_NAME,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-ui-settings';
import { DEFAULT_EXTERNAL_APPS_SCHEMA_ID } from '@/src/constants/external-apps';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';
import { ApplicationTypeToSourceType } from '@/src/constants/marketplace';
import {
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_2_ID,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
} from '@/src/constants/quick-apps';

import { AppsEditorSchemaTypes } from '@/src/components/AppsEditor/form';

import {
  EntityStorageLimits,
  buildByteAwareFitBaseName,
  getAvailableEntityNameBytes,
  getResourceStorageLimits,
  getStorageSafeUniqueName,
  prepareEntityName,
  truncateToUtf8Bytes,
} from './common';
import { constructPath } from './file';
import { getFolderIdFromEntityId } from './folders';
import { getApplicationRootId, getEntityBucket, isApplicationId } from './id';
import { isEntityIdPublic } from './publications';
import { splitEntityId } from './shared-utils';
import { translate } from './translation';

import isObject from 'lodash-es/isObject';
import omit from 'lodash-es/omit';

export const safeStringifyApplicationFeatures = (
  featureData: DialAIEntityFeatures | Record<string, string> | undefined,
) => {
  if (
    !featureData ||
    (isObject(featureData) && !Object.keys(featureData).length)
  ) {
    return '';
  }

  return JSON.stringify(featureData, null, 2);
};

export const getGeneratedApplicationId = (
  application: PartialBy<ApplicationInfo, 'id' | 'folderId'>,
): string => {
  if (application.folderId) {
    return constructPath(
      application.folderId,
      getMarketplaceEntityApiKey(application),
    );
  }

  return constructPath(
    getApplicationRootId(
      application.id ? getEntityBucket({ id: application.id }) : undefined,
    ),
    getMarketplaceEntityApiKey(application),
  );
};

export const regenerateApplicationId = <T extends ApplicationInfo>(
  application: PartialBy<T, 'id'>,
): T => {
  const newId = getGeneratedApplicationId(application);
  if (!application.id || newId !== application.id) {
    return {
      ...application,
      id: newId,
    } as T;
  }
  return application as T;
};

export const getAvailableApplicationNameBytes = (
  application: PartialBy<ApplicationInfo, 'id' | 'folderId'>,
  limits: EntityStorageLimits = getResourceStorageLimits(),
): number | undefined =>
  getAvailableEntityNameBytes(
    (name) => getGeneratedApplicationId({ ...application, name }),
    (name) => getMarketplaceEntityApiKey({ ...application, name }),
    limits,
  );

export const fitApplicationNameToStorageLimits = <
  T extends PartialBy<ApplicationInfo, 'id' | 'folderId'>,
>(
  application: T,
  limits: EntityStorageLimits = getResourceStorageLimits(),
): T => {
  const availableNameBytes = getAvailableApplicationNameBytes(
    application,
    limits,
  );

  if (availableNameBytes === undefined || availableNameBytes <= 0) {
    return application;
  }

  const fittedName = prepareEntityName(
    truncateToUtf8Bytes(
      prepareEntityName(application.name),
      availableNameBytes,
    ),
  );

  return fittedName === application.name
    ? application
    : ({ ...application, name: fittedName } as T);
};

export const getStorageSafeUniqueApplicationName = (params: {
  application: PartialBy<ApplicationInfo, 'id' | 'folderId'>;
  desiredName?: string;
  defaultName?: string;
  existingNames: string[];
  limits?: EntityStorageLimits;
}): string => {
  const { application, desiredName, existingNames } = params;
  const limits = params.limits ?? getResourceStorageLimits();
  const defaultName = params.defaultName ?? DEFAULT_APPLICATION_NAME;

  const availableNameBytes = getAvailableApplicationNameBytes(
    application,
    limits,
  );

  const uniqueName = getStorageSafeUniqueName({
    desiredName,
    defaultName,
    existingNames,
    fitBaseName: buildByteAwareFitBaseName(availableNameBytes),
  });

  if (uniqueName) {
    return uniqueName;
  }

  return fitApplicationNameToStorageLimits({
    ...application,
    name:
      prepareEntityName(desiredName ?? '') || prepareEntityName(defaultName),
  }).name;
};

export const mapApplicationPropertiesToApi = (
  properties: CustomApplicationModel['applicationProperties'],
) => {
  if (!properties) {
    return properties;
  }

  let documentsRelativeUrls:
    | QuickApp2Config['contexts']
    | QuickAppConfig['document_relative_url'];
  const propertiesQA = properties as QuickAppConfig;
  const propertiesQA2 = properties as QuickApp2Config;
  const result = {
    ...properties,
  };

  if (propertiesQA2.contexts) {
    documentsRelativeUrls = propertiesQA2.contexts.map((context) => ({
      ...context,
      url: ApiUtils.encodeApiUrl(context.url),
    }));
    (result as QuickApp2Config).contexts = documentsRelativeUrls;
  } else {
    if (!propertiesQA.document_relative_url) {
      (result as QuickAppConfig).document_relative_url = [];
    } else {
      documentsRelativeUrls = propertiesQA.document_relative_url.map((url) =>
        ApiUtils.encodeApiUrl(url),
      );
      (result as QuickAppConfig).document_relative_url = documentsRelativeUrls;
    }
  }

  return result;
};

export const convertApplicationToApi = (
  applicationData: Omit<CustomApplicationModel, 'id'>,
  schema?: ApiDetailedApplicationTypeSchema,
): ApiApplicationModel => {
  const commonData: ApiApplicationModelBase = {
    display_name: applicationData.name,
    display_version: applicationData.version,
    icon_url: ApiUtils.encodeApiUrl(applicationData.iconUrl ?? ''),
    description: applicationData.description,
    features: applicationData.features,
    input_attachment_types: applicationData.inputAttachmentTypes,
    max_input_attachments: applicationData.maxInputAttachments,
    reference: applicationData.reference || undefined,
    description_keywords: applicationData.topics,
  };

  if (schema) {
    return {
      ...commonData,
      application_properties:
        (applicationData.applicationProperties &&
          mapApplicationPropertiesToApi(
            applicationData.applicationProperties,
          )) ||
        null,
      application_type_schema_id:
        applicationData.applicationTypeSchemaId ?? schema['$id'],
    };
  }

  if (applicationData.function) {
    return {
      ...commonData,
      function: {
        runtime: applicationData.function.runtime ?? 'python3.11',
        source_folder: `${ApiUtils.encodeApiUrl(applicationData.function.sourceFolder)}/`,
        mapping: applicationData.function.mapping,
        ...(applicationData.function.env && {
          env: applicationData.function.env,
        }),
      },
    };
  }

  if (commonData.applicationTypeSchemaId) {
    return commonData as ApiApplicationModelSchema;
  }

  return {
    ...commonData,
    endpoint: applicationData.completionUrl ?? '',
  };
};

// migrate document_relative_url: string to document_relative_url: string[]
export const mapApplicationPropertiesFromApi = (
  properties: CustomApplicationModel['applicationProperties'],
) => {
  if (!properties) {
    return properties;
  }

  let documentsRelativeUrls:
    | QuickApp2Config['contexts']
    | QuickAppConfig['document_relative_url'];
  const propertiesQA = properties as QuickAppConfig;
  const propertiesQA2 = properties as QuickApp2Config;
  const result = {
    ...properties,
  };

  if (propertiesQA2.contexts) {
    documentsRelativeUrls = propertiesQA2.contexts.map((context) => ({
      ...context,
      url: ApiUtils.decodeApiUrl(context.url),
    }));
    (result as QuickApp2Config).contexts = documentsRelativeUrls;
  } else {
    if (!propertiesQA.document_relative_url) {
      (result as QuickAppConfig).document_relative_url = [];
    } else {
      const documentsRelativeUrlArr = Array.isArray(
        propertiesQA.document_relative_url,
      )
        ? propertiesQA.document_relative_url
        : [propertiesQA.document_relative_url];
      documentsRelativeUrls = documentsRelativeUrlArr.map(
        ApiUtils.decodeApiUrl,
      );
      (result as QuickAppConfig).document_relative_url = documentsRelativeUrls;
    }
  }

  // TODO: Remove after migrating old apps from 'name' to 'deployment_id'
  type DeploymentField = keyof QuickApp2Config['orchestrator']['deployment'];
  if (
    typeof propertiesQA2?.orchestrator?.deployment?.[
      'name' as DeploymentField
    ] === 'string'
  ) {
    (result as QuickApp2Config).orchestrator.deployment.deployment_id =
      propertiesQA2.orchestrator.deployment.deployment_id
        ? propertiesQA2.orchestrator.deployment.deployment_id
        : (propertiesQA2.orchestrator.deployment[
            'name' as DeploymentField
          ] as string);
    delete (result as QuickApp2Config).orchestrator.deployment[
      'name' as DeploymentField
    ];
  }

  return result;
};

export const convertApplicationFromApi = (
  application: ApiApplicationResponse,
): CustomApplicationModel => {
  const id = ApiUtils.decodeApiUrl(
    'application' in application ? application.application : application.name,
  );

  const appFunction = application.function
    ? {
        ...omit(application.function, ['source_folder']),
        sourceFolder: ApiUtils.decodeApiUrl(application.function.source_folder),
      }
    : undefined;

  return {
    ...omit(application, ['function', 'endpoint']),
    isDefault: false,
    type: EntityType.Application,
    id,
    inputAttachmentTypes: application.input_attachment_types,
    applicationProperties: mapApplicationPropertiesFromApi(
      application.application_properties,
    ),
    applicationTypeSchemaId: application.application_type_schema_id,
    iconUrl: ApiUtils.decodeApiUrl(application.icon_url),
    maxInputAttachments: application.max_input_attachments,
    version: application.display_version,
    name: application.display_name,
    completionUrl: application.endpoint ?? '',
    folderId: getFolderIdFromEntityId(id),
    topics: application.description_keywords,
    ...(appFunction && {
      function: appFunction,
      functionStatus: appFunction.status,
    }),
    owner: application.author,
    createdAt: application.created_at,
    updatedAt: application.updated_at,
  };
};

export const isQuickApp = (entity: DialAIEntityModel) =>
  entity.applicationTypeSchemaId ===
  DefaultsService.get('quickAppsSchemaId', DEFAULT_QUICK_APPS_SCHEMA_ID);

export const isQuickApp2 = (entity: DialAIEntityModel) =>
  entity.applicationTypeSchemaId ===
  DefaultsService.get('quickAppsSchemaId2', DEFAULT_QUICK_APPS_SCHEMA_2_ID);

export const isExternalApp = (entity: DialAIEntityModel) =>
  entity.applicationTypeSchemaId ===
  DefaultsService.get('externalAppsSchemaId', DEFAULT_EXTERNAL_APPS_SCHEMA_ID);

export const getModelDescription = (entity: { description?: string }) => {
  return entity.description ?? '';
};

export const getModelShortDescription = (entity: { description?: string }) =>
  getModelDescription(entity).split(DESCRIPTION_DELIMITER_REGEX)[0];

export const getQuickAppConfig = (
  entity: CustomApplicationModel,
): QuickAppConfig => {
  return (entity.applicationProperties as QuickAppConfig)?.web_api_toolset
    ? (entity.applicationProperties as QuickAppConfig)
    : {
        instructions: '',
        model: DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL),
        temperature: DEFAULT_TEMPERATURE,
        web_api_toolset: {},
      };
};

export const getQuickApp2Config = (
  entity: CustomApplicationModel,
): QuickApp2Config => {
  return entity.applicationProperties as QuickApp2Config;
};

export const getQuickAppDocumentUrl = (entity?: CustomApplicationModel) => {
  return entity ? getQuickAppConfig(entity)?.document_relative_url : undefined;
};

export const getQuick2AppDocumentUrl = (entity?: CustomApplicationModel) => {
  return (
    (entity &&
      getQuickApp2Config(entity)?.contexts?.map((context) => context.url)) ||
    undefined
  );
};

export const getToolsetStr = (
  config: QuickAppConfig,
  toolsetKey: keyof QuickAppConfig,
) => {
  try {
    return JSON.stringify(config[toolsetKey], null, 2);
  } catch {
    return '';
  }
};

export const getMcpToolsetStr = (config: QuickAppConfig) => {
  return getToolsetStr(config, 'mcp_toolset');
};

export const getWebAPIToolsetStr = (config: QuickAppConfig) => {
  return getToolsetStr(config, 'web_api_toolset');
};

export const topicToOption = (topic: string) => ({
  value: topic,
  label: topic,
  ...getTopicColors(topic),
});

export const isExecutableApp = (entity: DialAIEntityModel) =>
  !!entity.functionStatus;

export const getApplicationType = (entity: DialAIEntityModel): string => {
  if (entity.applicationTypeSchemaId) {
    return entity.applicationTypeSchemaId;
  }
  if (isExecutableApp(entity)) return ApplicationType.CODE_APP;

  return ApplicationType.CUSTOM_APP;
};

export const getApplicationNextStatus = (entity: DialAIEntityModel) => {
  return entity.functionStatus === ApplicationStatus.DEPLOYED
    ? ApplicationStatus.UNDEPLOYING
    : ApplicationStatus.DEPLOYING;
};

export const getApplicationSimpleStatus = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return SimpleApplicationStatus.DEPLOY;
    case ApplicationStatus.DEPLOYED:
      return SimpleApplicationStatus.UNDEPLOY;
    default:
      return SimpleApplicationStatus.UPDATING;
  }
};

export const isApplicationStatusUpdating = (entity: DialAIEntityModel) => {
  return (
    entity.functionStatus === ApplicationStatus.DEPLOYING ||
    entity.functionStatus === ApplicationStatus.UNDEPLOYING ||
    entity.functionStatus === ApplicationStatus.REDEPLOYING ||
    entity.functionStatus === ApplicationStatus.DEPLOYED
  );
};

export const isApplicationDeployed = (entity: DialAIEntityModel) => {
  return entity.functionStatus === ApplicationStatus.DEPLOYED;
};

export const isApplicationTypeKey = (
  key: string,
): key is keyof typeof ApplicationTypeToSourceType => {
  return key in ApplicationTypeToSourceType;
};

export const isApplicationDeploymentInProgress = (
  entity: DialAIEntityModel,
) => {
  return (
    entity.functionStatus === ApplicationStatus.DEPLOYING ||
    entity.functionStatus === ApplicationStatus.UNDEPLOYING ||
    entity.functionStatus === ApplicationStatus.REDEPLOYING
  );
};

export const isApplicationType = (value: unknown): value is ApplicationType => {
  return Object.values(ApplicationType).includes(value as ApplicationType);
};
export const getSharedTooltip = (context: string) => {
  return translate(MarketplaceI18nKeys.CannotChangeSharedApp, {
    ns: Translation.Marketplace,
    context,
  });
};

export const isMarketplaceEntityPublic = (
  entity: DialAIEntityModel | ToolsetModel,
) => isEntityIdPublic(entity) || entity.id === entity.reference;

export const getPlayerCaption = (entity: DialAIEntityModel) => {
  switch (entity.functionStatus) {
    case ApplicationStatus.DEPLOYED:
      return 'Undeploy';
    case ApplicationStatus.UNDEPLOYED:
    case ApplicationStatus.FAILED:
      return 'Deploy';
    case ApplicationStatus.UNDEPLOYING:
      return 'Undeploying';
    case ApplicationStatus.REDEPLOYING:
      return 'Redeploying';
    case ApplicationStatus.DEPLOYING:
    default:
      return 'Deploying';
  }
};

export const isDialAiEntityModel = (
  entity: MarketplaceEntity,
): entity is DialAIEntityModel =>
  entity?.type === EntityType.Application || entity?.type === EntityType.Model;

const checkAppEditorType =
  (editorSchemaType: keyof Defaults, defaultSchemaId: string) =>
  (type: string): boolean => {
    const schemaId = DefaultsService.get(editorSchemaType, defaultSchemaId);
    return schemaId.endsWith(type);
  };

export const isQuickAppEditor = checkAppEditorType(
  'quickAppsSchemaId',
  DEFAULT_QUICK_APPS_SCHEMA_ID,
);

export const isQuickApp2Editor = checkAppEditorType(
  'quickAppsSchemaId2',
  DEFAULT_QUICK_APPS_SCHEMA_2_ID,
);

export const isExternalAppEditor = checkAppEditorType(
  'externalAppsSchemaId',
  DEFAULT_EXTERNAL_APPS_SCHEMA_ID,
);

export const getEditorSchemaType = (
  type: string,
  schema?: ApiDetailedApplicationTypeSchema,
): AppsEditorSchemaTypes => {
  if (type === ApplicationType.CODE_APP) return AppsEditorSchemaTypes.CodeApp;

  if (isQuickAppEditor(type)) return AppsEditorSchemaTypes.QuickApp;

  if (isQuickApp2Editor(type)) return AppsEditorSchemaTypes.QuickApp2;

  if (isExternalAppEditor(type)) return AppsEditorSchemaTypes.ExternalApp;

  if (schema?.properties) {
    return AppsEditorSchemaTypes.SchemaDriven;
  }

  return AppsEditorSchemaTypes.CustomApp;
};

export const getEntityDisplayName = (
  id: string,
  allEntitiesMap: Record<string, MarketplaceEntity | undefined>,
): string => {
  const entity = allEntitiesMap[id];
  if (entity?.name) {
    return entity.name;
  }

  return ApiUtils.decodeApiUrl(
    parseEntityApiKey(splitEntityId(id).name, {
      parseVersion: true,
    }).name,
  );
};

// TODO: Remove after migrating all old toolsets with 'dial_id' to 'deployment_id'
export const migrateMCPToolsetIdName = (
  item: MCPToolset & { dial_id?: string },
) => {
  if (typeof item.dial_id === 'string') {
    return {
      ...omit(item, ['dial_id']),
      deployment_id: item.deployment_id ? item.deployment_id : item.dial_id,
    } as MCPToolset;
  }
  return item as MCPToolset;
};

export const getQuickAppItemNameFromConfig = (
  item: MCPToolset | DialAppToolset | DialDeploymentSimpleTool,
): string => {
  if ('deployment_id' in item && 'name' in item) {
    return (
      item.name ||
      ApiUtils.decodeApiUrl(
        parseEntityApiKey(splitEntityId(item.deployment_id).name, {
          parseVersion: true,
        }).name,
      )
    );
  }

  if (isApplicationId(item.deployment_id)) {
    return ApiUtils.decodeApiUrl(
      parseEntityApiKey(splitEntityId(item.deployment_id).name, {
        parseVersion: true,
      }).name,
    );
  }

  if ('open_ai_tool' in item) {
    return (
      (item.open_ai_tool as { function?: { name?: string } })?.function?.name ||
      'OpenAI Tool'
    );
  }

  if ('name' in item && typeof item.name === 'string') {
    return item.name;
  }

  if (!item.deployment_id) {
    console.error('Dial Tool is missing deployment_id:', item);
    return 'unknown';
  }

  return item.deployment_id;
};

export const getApplicationMcpUrl = (id: string) =>
  `${DefaultsService.get('dialCoreExternalUrl')}/v1/deployments/${ServerUtils.encodeSlugs(id.split('/'))}/mcp`;
