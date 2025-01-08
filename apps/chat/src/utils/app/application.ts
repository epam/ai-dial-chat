import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import { getTopicColors } from '@/src/utils/app/style-helpers';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-chema';
import {
  ApiApplicationModel,
  ApiApplicationResponse,
  ApplicationInfo,
  ApplicationSlug,
  ApplicationStatus,
  CustomApplicationModel,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { EntityType, PartialBy } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { QuickAppConfig } from '@/src/types/quick-apps';

import { DESCRIPTION_DELIMITER_REGEX } from '@/src/constants/chat';
import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';
import {
  DEFAULT_QUICK_APPS_MODEL,
  QUICK_APP_CONFIG_DIVIDER,
} from '@/src/constants/quick-apps';

import { ApiUtils, getApplicationApiKey } from '../server/api';
import { constructPath } from './file';
import { getFolderIdFromEntityId } from './folders';
import { getApplicationRootId } from './id';

import { merge } from 'lodash-es';
import omit from 'lodash-es/omit';

export const getGeneratedApplicationId = (
  application: Omit<ApplicationInfo, 'id'>,
): string => {
  return constructPath(
    getApplicationRootId(),
    getApplicationApiKey(application),
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

export const convertApplicationToApi = (
  applicationData: Omit<CustomApplicationModel, 'id'>,
  schema?: ApiDetailedApplicationTypeSchema,
): ApiApplicationModel => {
  const commonData = {
    display_name: applicationData.name,
    display_version: applicationData.version,
    icon_url: ApiUtils.encodeApiUrl(applicationData.iconUrl ?? ''),
    description: applicationData.description,
    features: applicationData.features,
    input_attachment_types: applicationData.inputAttachmentTypes,
    max_input_attachments: applicationData.maxInputAttachments,
    defaults: {},
    reference: applicationData.reference || undefined,
    description_keywords: applicationData.topics,
    custom_app_schema_id: applicationData.custom_app_schema_id,
  };

  if (schema) {
    const filledRequiredFields = fillSchemaFromApplicationData(
      schema,
      schema.$defs,
      applicationData,
    );
    return {
      ...merge({}, filledRequiredFields, commonData),
    } as unknown as ApiApplicationModel;
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

  return {
    ...commonData,
    endpoint: applicationData.completionUrl,
  };
};

const getDefaultValue = (
  propertySchema: any,
  definitions: Record<string, any> = {},
  applicationData: Record<string, any> = {},
): Record<string, any> | null => {
  if (!propertySchema || typeof propertySchema !== 'object') {
    return null;
  }

  if (propertySchema.$ref) {
    const refPath = propertySchema.$ref.replace(/^#\/\$defs\//, '');
    const refSchema = definitions[refPath];

    if (refSchema) {
      return getDefaultValue(refSchema, definitions, applicationData);
    } else {
      return null;
    }
  }

  switch (propertySchema.type) {
    case 'string':
      return (
        propertySchema.default ??
        (propertySchema.enum ? propertySchema.enum[0] : '')
      );
    case 'number':
    case 'integer':
      return propertySchema.default ?? 0;
    case 'boolean':
      return propertySchema.default ?? false;
    case 'array': {
      if (Array.isArray(propertySchema.items)) {
        return propertySchema.items.map((item: any) =>
          item.$ref
            ? getDefaultValue(
                definitions[item.$ref.replace(/^#\/\$defs\//, '')],
                definitions,
              )
            : fillSchemaFromApplicationData(item, definitions, applicationData),
        );
      } else if (
        propertySchema.items &&
        typeof propertySchema.items === 'object'
      ) {
        if (propertySchema.items.$ref) {
          const refPath = propertySchema.items.$ref.replace(/^#\/\$defs\//, '');
          const refSchema = definitions[refPath];

          if (refSchema) {
            return [
              fillSchemaFromApplicationData(
                refSchema,
                definitions,
                applicationData,
              ),
            ];
          }
        }
        return [
          fillSchemaFromApplicationData(
            propertySchema.items,
            definitions,
            applicationData,
          ),
        ];
      }
      return [];
    }
    case 'object': {
      return fillSchemaFromApplicationData(
        propertySchema,
        definitions,
        applicationData,
      );
    }
    default:
      return null;
  }
};

function fillSchemaFromApplicationData(
  schema: ApiDetailedApplicationTypeSchema,
  definitions: Record<string, any> = {},
  applicationData: Record<string, any> = {},
): Record<string, any> | null {
  if (!schema || typeof schema !== 'object') {
    return null;
  }

  const filledFields: Record<string, any> = {};
  const requiredFields = schema.required || [];
  const properties = schema.properties || {};

  for (const key of Object.keys(applicationData)) {
    const propertySchema = properties[key] as ApiDetailedApplicationTypeSchema;

    if (propertySchema && typeof propertySchema === 'object') {
      if (propertySchema.type === 'object') {
        filledFields[key] = fillSchemaFromApplicationData(
          propertySchema,
          definitions,
          applicationData[key] || {},
        );
      } else if (propertySchema.type === 'array') {
        filledFields[key] = Array.isArray(applicationData[key])
          ? applicationData[key].map((item: any) =>
              processArrayItem(item, propertySchema.items, definitions),
            )
          : [];
      } else {
        filledFields[key] = applicationData[key];
      }
    } else {
      filledFields[key] = applicationData[key];
    }
  }

  for (const key of requiredFields) {
    const propertySchema = properties[key];
    if (
      propertySchema &&
      typeof propertySchema === 'object' &&
      filledFields[key] === undefined
    ) {
      if (propertySchema.type === 'array') {
        filledFields[key] = getDefaultArray(propertySchema, definitions);
      } else {
        filledFields[key] =
          applicationData[key] !== undefined
            ? applicationData[key]
            : getDefaultValue(propertySchema, definitions);
      }
    }
  }

  return filledFields;
}

function processArrayItem(
  item: any,
  itemSchema: any,
  definitions: Record<string, any>,
) {
  if (itemSchema && typeof itemSchema === 'object') {
    if (itemSchema.$ref) {
      const refPath = itemSchema.$ref.replace(/^#\/\$defs\//, '');
      const refSchema = definitions[refPath];

      return refSchema
        ? fillSchemaFromApplicationData(refSchema, definitions, item || {})
        : item;
    } else if (itemSchema.type === 'object') {
      return fillSchemaFromApplicationData(itemSchema, definitions, item || {});
    }
  }
  return item !== undefined ? item : getDefaultValue(itemSchema, definitions);
}

function getDefaultArray(
  propertySchema: any,
  definitions: Record<string, any>,
): any[] {
  if (
    propertySchema &&
    typeof propertySchema === 'object' &&
    propertySchema.items
  ) {
    return [getDefaultValue(propertySchema.items, definitions)];
  }
  return [];
}

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
  };
};

export const isQuickApp = (entity: DialAIEntityModel) => {
  const { description } = entity;

  return !!description?.includes(QUICK_APP_CONFIG_DIVIDER);
};

export const getModelDescription = (entity: DialAIEntityModel) => {
  return entity.description
    ? entity.description.split(QUICK_APP_CONFIG_DIVIDER)[0]
    : '';
};

export const getModelShortDescription = (entity: DialAIEntityModel) =>
  getModelDescription(entity).split(DESCRIPTION_DELIMITER_REGEX)[0];

export const parseQuickAppDescription = (desc: string) => {
  const [description, config] = desc.split(QUICK_APP_CONFIG_DIVIDER);

  return {
    description,
    config,
  };
};

export const parseQuickAppConfig = (
  entity: { name: string; description: string },
  config?: string,
): QuickAppConfig => {
  const defaultConfig = {
    description: entity.description,
    instructions: '',
    model: 'gpt-4o',
    name: entity.name,
    temperature: DEFAULT_TEMPERATURE,
    web_api_toolset: {},
  };
  if (!config) {
    return defaultConfig;
  }
  try {
    return JSON.parse(config);
  } catch {
    return defaultConfig;
  }
};

export const getQuickAppConfig = (entity: DialAIEntityModel) => {
  const { description, config } = parseQuickAppDescription(
    entity.description ?? QUICK_APP_CONFIG_DIVIDER,
  );

  let parsedConfig: QuickAppConfig;
  try {
    parsedConfig = JSON.parse(config);
  } catch {
    parsedConfig = {
      description: getModelDescription(entity),
      instructions: '',
      model: DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL),
      name: entity.name,
      temperature: DEFAULT_TEMPERATURE,
      web_api_toolset: {},
    };
  }

  return {
    description,
    config: parsedConfig,
  };
};

export const createQuickAppConfig = ({
  description,
  instructions,
  name,
  temperature,
  config,
}: {
  description: string;
  instructions: string;
  name: string;
  temperature: number;
  config: string;
}) => {
  const preparedConfig: QuickAppConfig = {
    description,
    instructions,
    name,
    temperature,
    web_api_toolset: JSON.parse(config ?? '{}'),
    model: DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL),
  };

  return [description.trim(), JSON.stringify(preparedConfig)].join(
    QUICK_APP_CONFIG_DIVIDER,
  );
};

export const topicToOption = (topic: string) => ({
  value: topic,
  label: topic,
  ...getTopicColors(topic),
});

export const isExecutableApp = (entity: DialAIEntityModel) =>
  !!entity.functionStatus;

export const getApplicationType = (entity: DialAIEntityModel) => {
  if (entity.topics?.find((topic) => isApplicationType(topic))) {
    return entity.topics.find((topic) => isApplicationType(topic))!;
  }
  if (isQuickApp(entity)) return ApplicationSlug.QUICK_APP;
  if (isExecutableApp(entity)) return ApplicationSlug.CODE_APP;

  return ApplicationSlug.CUSTOM_APP;
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
    entity.functionStatus === ApplicationStatus.DEPLOYED
  );
};

export const isApplicationDeployed = (entity: DialAIEntityModel) => {
  return entity.functionStatus === ApplicationStatus.DEPLOYED;
};

export const isApplicationDeploymentInProgress = (
  entity: DialAIEntityModel,
) => {
  return (
    entity.functionStatus === ApplicationStatus.DEPLOYING ||
    entity.functionStatus === ApplicationStatus.UNDEPLOYING
  );
};

export const isApplicationType = (value: unknown): value is ApplicationSlug => {
  return Object.values(ApplicationSlug).includes(value as ApplicationSlug);
};
