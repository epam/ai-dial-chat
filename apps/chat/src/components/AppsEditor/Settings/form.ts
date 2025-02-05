import {
  Path,
  RegisterOptions,
  UseFormClearErrors,
  UseFormSetError,
} from 'react-hook-form';

import { safeStringifyApplicationFeatures } from '@/src/utils/app/application';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import { constructPath } from '@/src/utils/app/file';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApiApplicationResponseDefault,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { QuickAppConfig } from '@/src/types/quick-apps';

import {
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';
import {
  DEFAULT_QUICK_APPS_HOST,
  DEFAULT_QUICK_APPS_MODEL,
} from '@/src/constants/quick-apps';

import { DynamicField } from '../../Common/Forms/DynamicFormFields';
import { ApplicationGeneralInfoFormData } from '../GeneralInfoView/form';

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
  maxInputAttachments: number;
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
  documentRelativeUrl: string;
  model: string;
}

export interface CodeAppFormData extends ApplicationGeneralInfoFormData {
  id: string;
  reference: string;
  inputAttachmentTypes: string[];
  maxInputAttachments: number;
  sources: string;
  sourceFiles?: string[];
  runtime: string;
  endpoints: DynamicField[];
  env: DynamicField[];
}

const getMappingsKeyOptions = (name: 'endpoints' | 'env') => ({
  validate: (v: string, data: CodeAppFormData) => {
    const reg = /^[a-zA-Z0-9_-]+$/;

    if (!v.trim()) return 'Key is required';
    if (!reg.test(v)) return 'Enter only valid symbols';
    if (data[name].filter(({ label }) => label === v.trim()).length > 1) {
      return 'Key must be unique';
    }

    return true;
  },
});

// TODO: implement better way to write types for nested array fields
export const endpointsKeyValidator = getMappingsKeyOptions(
  'endpoints',
) as unknown as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;
export const envKeysValidator = getMappingsKeyOptions(
  'env',
) as unknown as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;
export const endpointsValueValidator = {
  validate: (value: string) => {
    const reg = /^[a-zA-Z0-9/_-]+$/;
    const val = value.trim();

    if (!val) return 'Endpoint is required';
    if (!val.startsWith('/')) return "Endpoint should start with '/'";
    if (!reg.test(val))
      return "Endpoint should contain only letters, numbers, '-', '_' and '/'";
    if (val.length > 255)
      return 'Endpoint should be no longer than 255 characters';

    return true;
  },
} as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;
export const envValueValidator = {
  required: 'Value is required',
} as RegisterOptions<CodeAppFormData, Path<CodeAppFormData>>;

export const getAttachmentTypeErrorHandlers = (
  setError: UseFormSetError<{ inputAttachmentTypes: string[] }>,
  clearErrors: UseFormClearErrors<{ inputAttachmentTypes: string[] }>,
) => {
  const validationRegExp = new RegExp(
    '^([a-zA-Z0-9!*\\-.+]+|\\*)\\/([a-zA-Z0-9!*\\-.+]+|\\*)$',
  );
  const handleError = () => {
    setError('inputAttachmentTypes', {
      type: 'manual',
      message: 'Please match the MIME format',
    });
  };
  const handleClearError = () => {
    clearErrors('inputAttachmentTypes');
  };

  return { validationRegExp, handleError, handleClearError };
};

const getApplicationGeneralDefaultValues = (
  app: ApiApplicationResponseDefault,
) => {
  return {
    name: app.display_name,
    id: app.name,
    description: app.description,
    version: app.display_version,
    iconUrl: app.icon_url ?? '',
    topics: app.description_keywords ?? [],
    reference: app.reference,
  };
};

export const getCodeAppDefaultValues = ({
  app,
  runtime,
}: {
  app: ApiApplicationResponseDefault;
  runtime?: string;
}): CodeAppFormData => {
  return {
    ...getApplicationGeneralDefaultValues(app),
    id: decodeURIComponent(app.name),
    reference: app.reference,
    completionUrl: app.endpoint ?? '',
    inputAttachmentTypes: app.input_attachment_types ?? [],
    maxInputAttachments: app.max_input_attachments ?? '',
    sources: app.function?.source_folder
      ? ApiUtils.decodeApiUrl(app.function.source_folder)
      : '',
    runtime: app?.function?.runtime ?? runtime ?? 'python3.11',
    endpoints: app?.function?.mapping
      ? Object.entries(app.function.mapping).map(([key, value]) => ({
          label: key,
          visibleName: FEATURES_ENDPOINTS_NAMES[key],
          value,
          editableKey:
            !FEATURES_ENDPOINTS[key as keyof typeof FEATURES_ENDPOINTS],
          static: key === FEATURES_ENDPOINTS.chat_completion,
        }))
      : [
          {
            label: FEATURES_ENDPOINTS.chat_completion,
            visibleName:
              FEATURES_ENDPOINTS_NAMES[FEATURES_ENDPOINTS.chat_completion],
            value:
              FEATURES_ENDPOINTS_DEFAULT_VALUES[
                FEATURES_ENDPOINTS.chat_completion
              ] || '',
            editableKey: false,
            static: true,
          },
        ],
    env: app?.function?.env
      ? Object.entries(app.function.env).map(([label, value]) => ({
          label,
          value,
          editableKey: true,
        }))
      : [],
  };
};

export const getCustomApplicationDefaultValues = ({
  app,
}: {
  app: ApiApplicationResponseDefault;
}): CustomApplicationFormData => ({
  ...getApplicationGeneralDefaultValues(app),
  inputAttachmentTypes: app.input_attachment_types ?? [],
  maxInputAttachments: app.max_input_attachments ?? '',
  completionUrl: app.endpoint ?? '',
  features: safeStringifyApplicationFeatures(app.features),
  applicationProperties: app.application_properties ?? null,
});

export const getQuickAppDefaultValues = ({
  app,
}: {
  app: ApiApplicationResponseDefault;
}): QuickAppFormData => {
  return {
    ...getApplicationGeneralDefaultValues(app),
    completionUrl: app.endpoint ?? '',
    documentRelativeUrl:
      typeof app.application_properties?.document_relative_url === 'string'
        ? app.application_properties?.document_relative_url
        : '',
    model:
      typeof app.application_properties?.model === 'string'
        ? app.application_properties?.model
        : DefaultsService.get('quickAppsModel', DEFAULT_QUICK_APPS_MODEL),
    instructions:
      typeof app.application_properties?.instructions === 'string'
        ? app.application_properties.instructions
        : '',
    temperature:
      typeof app.application_properties?.temperature === 'number'
        ? app.application_properties.temperature
        : DEFAULT_TEMPERATURE,
    toolset:
      getToolsetStr({
        web_api_toolset: app.application_properties?.web_api_toolset ?? [],
      } as QuickAppConfig) ?? '',
  };
};

const getGeneralApplicationData = (
  formData: CustomApplicationFormData | QuickAppFormData | CodeAppFormData,
) => ({
  type: EntityType.Application,
  name: formData.name,
  iconUrl: formData.iconUrl,
  topics: formData.topics,
  description: formData.description,
  version: formData.version,
});

export const getCodeAppData = (
  formData: CodeAppFormData,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  return {
    ...getGeneralApplicationData(formData),
    isDefault: false,
    folderId: '',
    completionUrl: '',
    applicationProperties: undefined,
    inputAttachmentTypes: formData.inputAttachmentTypes,
    maxInputAttachments: formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined,
    function: {
      sourceFolder: formData.sources,
      mapping: formData.endpoints.reduce(
        (acc, option) => ({
          ...acc,
          [option.label]: option.value.trim(),
        }),
        {},
      ),
      env: formData.env.length
        ? formData.env.reduce(
            (acc, option) => ({
              ...acc,
              [option.label]: option.value,
            }),
            {},
          )
        : undefined,
      runtime: formData.runtime,
    },
  };
};

export const getCustomApplicationData = (
  formData: CustomApplicationFormData,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  const preparedData: Omit<CustomApplicationModel, 'id' | 'reference'> = {
    ...getGeneralApplicationData(formData),

    isDefault: false,
    folderId: '',
    applicationProperties: formData.applicationProperties ?? undefined,
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
    applicationProperties: {
      instructions: formData.instructions,
      temperature: formData.temperature,
      web_api_toolset: JSON.parse(formData.toolset),
      model: formData.model,
      document_relative_url: formData.documentRelativeUrl,
    },
    completionUrl: constructPath(
      DefaultsService.get('quickAppsHost', DEFAULT_QUICK_APPS_HOST),
      'openai/deployments',
      ApiUtils.safeEncodeURIComponent(formData.name.trim()),
      'chat/completions',
    ),
    isDefault: false,
    folderId: '',
  };
};
