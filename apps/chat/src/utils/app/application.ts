import { getTopicColors } from '@/src/utils/app/style-helpers';

import {
  ApiApplicationModel,
  ApiApplicationResponse,
  ApplicationInfo,
  ApplicationStatus,
  ApplicationType,
  CustomApplicationModel,
  SimpleApplicationStatus,
} from '@/src/types/applications';
import { EntityType, PartialBy } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { QuickAppConfig } from '@/src/types/quick-apps';

import { DESCRIPTION_DELIMITER_REGEX } from '@/src/constants/chat';
import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';
import { QUICK_APP_CONFIG_DIVIDER } from '@/src/constants/quick-apps';

import { ApiUtils, getApplicationApiKey } from '../server/api';
import { constructPath } from './file';
import { getFolderIdFromEntityId } from './folders';
import { getApplicationRootId } from './id';

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
  };

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
      model: 'gpt-4o',
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
    model: 'gpt-4o',
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
  if (isQuickApp(entity)) return ApplicationType.QUICK_APP;
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
    entity.functionStatus === ApplicationStatus.DEPLOYED
  );
};
