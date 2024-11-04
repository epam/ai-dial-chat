import {
  Path,
  RegisterOptions,
  UseFormClearErrors,
  UseFormSetError,
} from 'react-hook-form';

import {
  createQuickAppConfig,
  getModelDescription,
  getQuickAppConfig,
} from '@/src/utils/app/application';
import { notAllowedSymbols } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { DialAIEntityFeatures } from '@/src/types/models';
import { QuickAppConfig } from '@/src/types/quick-apps';

import {
  CODEAPPS_REQUIRED_FILES,
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import {
  DEFAULT_APPLICATION_NAME,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-ui-settings';
import { MIME_FORMAT_REGEX } from '@/src/constants/file';
import { DEFAULT_VERSION } from '@/src/constants/public';

import { DynamicField } from '@/src/components/Common/Forms/DynamicFormFields';

import { ShareEntity } from '@epam/ai-dial-shared';
import isObject from 'lodash-es/isObject';

export interface FormData {
  name: string;
  description: string;
  version: string;
  iconUrl: string;
  topics: string[];
  inputAttachmentTypes: string[];
  maxInputAttachments: string;
  completionUrl: string;
  features: string | null;
  // QUICK APP
  instructions: string;
  temperature: number;
  toolset: string;
  // DEPLOYABLE APP
  sources: string;
  sourceFiles?: string[];
  runtime: string;
  endpoints: DynamicField[];
  env: DynamicField[];
}

type Options<T extends Path<FormData>> = Omit<
  RegisterOptions<FormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof FormData]?: Options<K>;
};

// VALIDATORS

export const validators: Validators = {
  name: {
    required: 'This field is required',
    validate: (v) => {
      const reg = new RegExp(`^[^${notAllowedSymbols}]{2,160}$`);

      return (
        reg.test(v) ||
        'Name should be 2 to 160 characters long and should not contain special characters'
      );
    },
  },
  version: {
    required: 'This field is required',
    validate: (v) => {
      const reg = /^[0-9]+\.[0-9]+\.[0-9]+$/;

      return (
        reg.test(v) ||
        'Version should be in x.y.z format and contain only numbers and dots.'
      );
    },
    setValueAs: (v) => {
      return (v as string).replace(/[^0-9.]/g, '');
    },
  },
  features: {
    validate: (data) => {
      if (!data?.trim()) return true;

      try {
        const object = JSON.parse(data);

        if (typeof object === 'object' && !!object && !Array.isArray(object)) {
          for (const [key, value] of Object.entries(object)) {
            if (!key.trim()) {
              return 'Keys should not be empty';
            }

            const valueType = typeof value;
            if (
              !(['boolean', 'number'].includes(valueType) || value === null)
            ) {
              if (typeof value === 'string' && !value.trim()) {
                return 'String values should not be empty';
              }

              if (!['boolean', 'number', 'string'].includes(valueType)) {
                return 'Values should be a string, number, boolean or null';
              }
            }
          }
        } else {
          return 'Data is not a valid JSON object';
        }

        return true;
      } catch (error) {
        return 'Invalid JSON string';
      }
    },
  },
  inputAttachmentTypes: {
    validate: (types) => {
      return (
        types.every((v) => MIME_FORMAT_REGEX.test(v)) ||
        'Please match the MIME format'
      );
    },
  },
  maxInputAttachments: {
    validate: (v) => {
      const reg = /^[0-9]*$/;

      return reg.test(String(v)) || 'Max attachments must be a number';
    },
    setValueAs: (v) => {
      return v.replace(/[^0-9]/g, '');
    },
  },
  completionUrl: {
    required: 'Completion URL is required',
    validate: (value) => {
      try {
        if (value.trim() !== value) {
          return 'Completion URL cannot start or end with spaces';
        }
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'Completion URL must start with http:// or https://';
        }
        new URL(value);
        const bannedEndings = ['.', '//'];
        const endsWithBannedEnding = bannedEndings.some((ending) =>
          value.endsWith(ending),
        );
        if (endsWithBannedEnding) {
          return 'Completion URL cannot end with . or //';
        }
        return true;
      } catch {
        return 'Completion URL should be a valid URL.';
      }
    },
  },
  toolset: {
    required: 'Toolset config is required',
    validate: (v) => {
      try {
        JSON.parse(v);
      } catch {
        return 'Config is not a valid JSON object';
      }
      return true;
    },
  },
  sources: {
    required: 'Source folder is required',
  },
  sourceFiles: {
    validate: (files: string[] | undefined) => {
      if (!files?.includes(CODEAPPS_REQUIRED_FILES.APP)) {
        return `This folder does not contain the required "${CODEAPPS_REQUIRED_FILES.APP}" file`;
      }
      if (!files.includes(CODEAPPS_REQUIRED_FILES.REQUIREMENTS)) {
        return `This folder does not contain the required "${CODEAPPS_REQUIRED_FILES.REQUIREMENTS}" file`;
      }

      return true;
    },
  },
};

const getMappingsKeyOptions = (name: 'endpoints' | 'env') => ({
  validate: (v: string, data: FormData) => {
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
) as unknown as RegisterOptions<FormData, Path<FormData>>;
export const envKeysValidator = getMappingsKeyOptions(
  'env',
) as unknown as RegisterOptions<FormData, Path<FormData>>;
export const endpointsValueValidator = {
  validate: (v: string) => {
    const reg = /^[a-zA-Z0-9/_-]+$/;

    if (!v.trim()) return 'Endpoint is required';
    if (!v.startsWith('/')) return "Endpoint should start with '/'";
    if (!reg.test(v))
      return "Endpoint should contain only letters, numbers, '-', '_' and '/'";
    if (v.length > 255)
      return 'Endpoint should be no longer than 255 characters';

    return true;
  },
} as RegisterOptions<FormData, Path<FormData>>;
export const envValueValidator = {
  required: 'Value is required',
} as RegisterOptions<FormData, Path<FormData>>;

export const getAttachmentTypeErrorHandlers = (
  setError: UseFormSetError<FormData>,
  clearErrors: UseFormClearErrors<FormData>,
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

// DATA TRANSFORMERS

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

const getToolsetStr = (config: QuickAppConfig) => {
  try {
    return JSON.stringify(config.web_api_toolset, null, 2);
  } catch {
    return '';
  }
};

export const getDefaultValues = ({
  app,
  models,
  runtime,
}: {
  app?: CustomApplicationModel;
  models?: ShareEntity[];
  runtime?: string;
}): FormData => ({
  name:
    app?.name ??
    getNextDefaultName(DEFAULT_APPLICATION_NAME, models ?? [], 0, true),
  description: app ? getModelDescription(app) : '',
  version: app?.version ?? DEFAULT_VERSION,
  iconUrl: app?.iconUrl ?? '',
  topics: app?.topics ?? [],
  inputAttachmentTypes: app?.inputAttachmentTypes ?? [],
  maxInputAttachments: String(app?.maxInputAttachments ?? ''),
  completionUrl: app?.completionUrl ?? '',
  features: safeStringify(app?.features),
  instructions: app ? getQuickAppConfig(app).config.instructions : '',
  temperature: app
    ? getQuickAppConfig(app).config.temperature
    : DEFAULT_TEMPERATURE,
  toolset: app ? getToolsetStr(getQuickAppConfig(app).config) : '',
  sources: app?.function?.sourceFolder ?? '',
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
  runtime: app?.function?.runtime ?? runtime ?? 'python3.11',
});

export const getApplicationData = (
  formData: FormData,
  type: ApplicationType,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  const preparedData: Omit<CustomApplicationModel, 'id' | 'reference'> = {
    name: formData.name.trim(),
    type: EntityType.Application,
    isDefault: false,
    folderId: '',
    topics: formData.topics,
    description: formData.description.trim(),
    completionUrl: formData.completionUrl,
    version: formData.version,
    iconUrl: formData.iconUrl,
    inputAttachmentTypes: formData.inputAttachmentTypes,
    maxInputAttachments: formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined,
  };
  if (type === ApplicationType.CUSTOM_APP) {
    preparedData.features = formData.features
      ? JSON.parse(formData.features)
      : null;
  }
  if (type === ApplicationType.QUICK_APP) {
    preparedData.description = createQuickAppConfig({
      description: formData.description ?? '',
      config: formData.toolset,
      instructions: formData.instructions ?? '',
      temperature: formData.temperature,
      name: formData.name.trim(),
    });
    preparedData.completionUrl = `http://quickapps.dial-development.svc.cluster.local/openai/deployments/${ApiUtils.safeEncodeURIComponent(formData.name.trim())}/chat/completions`;
  }

  if (type === ApplicationType.CODE_APP) {
    preparedData.function = {
      runtime: formData.runtime,
      sourceFolder: formData.sources,
      mapping: formData.endpoints.reduce(
        (acc, option) => ({
          ...acc,
          [option.label]: option.value,
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
    };
  }

  return preparedData;
};
