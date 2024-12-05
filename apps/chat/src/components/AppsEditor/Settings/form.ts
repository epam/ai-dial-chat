import {
  createQuickAppConfig,
  parseQuickAppConfig,
  parseQuickAppDescription,
} from '@/src/utils/app/application';

import {
  ApiApplicationResponseDefault,
  ApplicationSlug,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { DialAIEntityFeatures } from '@/src/types/models';
import { QuickAppConfig } from '@/src/types/quick-apps';

import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';

import { ApplicationGeneralInfoFormData } from '../GeneralInfoView/form';

import { isObject } from 'lodash-es';

const getToolsetStr = (config: QuickAppConfig) => {
  try {
    return JSON.stringify(config.web_api_toolset, null, 2);
  } catch {
    return '';
  }
};

export interface CustomApplicationFormData
  extends ApplicationGeneralInfoFormData {
  inputAttachmentTypes: string[];
  maxInputAttachments: string;
  completionUrl: string;
  features: string | null;
  id: string;
  reference: string;
}

export interface QuickAppFormData extends ApplicationGeneralInfoFormData {
  id: string;
  reference: string;
  instructions: string;
  temperature: number;
  toolset: string;
}

const safeStringify = (
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

const getApplicationGeneralDefaultValues = (
  app: ApiApplicationResponseDefault,
  type?: ApplicationSlug,
) => {
  return {
    name: app.display_name,
    id: app.name,
    description:
      type === ApplicationSlug.QUICK_APP
        ? parseQuickAppDescription(app.description).description
        : app.description,
    version: app.display_version,
    iconUrl: app.icon_url ?? '',
    topics: app.description_keywords ?? [],
    reference: app.reference,
  };
};

export const getCustomApplicationDefaultValues = ({
  app,
}: {
  app: ApiApplicationResponseDefault;
}): CustomApplicationFormData => ({
  ...getApplicationGeneralDefaultValues(app),
  inputAttachmentTypes: app.input_attachment_types ?? [],
  maxInputAttachments: String(app.max_input_attachments ?? ''),
  completionUrl: app.endpoint ?? '',
  features: safeStringify(app.features),
});

export const getQuickAppDefaultValues = ({
  app,
}: {
  app: ApiApplicationResponseDefault;
}): QuickAppFormData => {
  const { description, config } = parseQuickAppDescription(app.description);
  const quickAppConfig = parseQuickAppConfig(
    {
      name: app.display_name,
      description,
    },
    config,
  );
  return {
    ...getApplicationGeneralDefaultValues(app, ApplicationSlug.QUICK_APP),
    completionUrl: app.endpoint ?? '',
    instructions: quickAppConfig.instructions ?? '',
    temperature: quickAppConfig.temperature ?? DEFAULT_TEMPERATURE,
    toolset: getToolsetStr(quickAppConfig) ?? '',
  };
};

const getGeneralApplicationData = (
  formData: CustomApplicationFormData | QuickAppFormData,
) => ({
  type: EntityType.Application,
  name: formData.name,
  iconUrl: formData.iconUrl,
  topics: formData.topics,
  description: formData.description,
  version: formData.version,
});

export const getCustomApplicationData = (
  formData: CustomApplicationFormData,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  const preparedData: Omit<CustomApplicationModel, 'id' | 'reference'> = {
    ...getGeneralApplicationData(formData),

    isDefault: false,
    folderId: '',

    completionUrl: formData.completionUrl,
    inputAttachmentTypes: formData.inputAttachmentTypes,
    maxInputAttachments: formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined,
    features: formData.features ? JSON.parse(formData.features) : null,
  };
  return preparedData;
};

export const getQuickAppData = (
  formData: QuickAppFormData,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  return {
    ...getGeneralApplicationData(formData),
    description: createQuickAppConfig({
      description: formData.description ?? '',
      config: formData.toolset,
      instructions: formData.instructions ?? '',
      temperature: formData.temperature,
      name: formData.name.trim(),
    }),
    isDefault: false,
    folderId: '',
    completionUrl: '',
  };
};
