import { Path, RegisterOptions } from 'react-hook-form';

import {
  createQuickAppConfig,
  getModelDescription,
  getQuickAppConfig,
} from '@/src/utils/app/application';
import { notAllowedSymbols, validateMimeFormat } from '@/src/utils/app/file';

import {
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType, SelectOption } from '@/src/types/common';
import { DialAIEntityFeatures } from '@/src/types/models';
import { QuickAppConfig } from '@/src/types/quick-apps';

import { DEFAULT_TEMPERATURE } from '@/src/constants/default-ui-settings';

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
  endpoints: SelectOption<string, string>[];
  env: SelectOption<string, string>[];
}

type Options<T extends Path<FormData>> = Omit<
  RegisterOptions<FormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof FormData]?: Options<K>;
};

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
  iconUrl: {
    required: 'Icon is required',
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
      return types.every(validateMimeFormat) || 'Please match the MIME format';
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
          return 'Completion URL cannot start or end with spaces' || '';
        }
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return 'Completion URL must start with http:// or https://' || '';
        }
        new URL(value);
        const bannedEndings = ['.', '//'];
        const endsWithBannedEnding = bannedEndings.some((ending) =>
          value.endsWith(ending),
        );
        if (endsWithBannedEnding) {
          return 'Completion URL cannot end with . or //' || '';
        }
        return true;
      } catch {
        return 'Completion URL should be a valid URL.' || '';
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
  endpoints: {
    validate: (v) => {
      const completion = v.find(
        ({ label }) => label.toLowerCase() === 'completion',
      );

      return !!completion?.value || 'Completion URL is required';
    },
  },
};

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

export const getDefaultValues = (app?: CustomApplicationModel): FormData => ({
  name: app?.name ?? '',
  description: app ? getModelDescription(app) : '',
  version: app?.version ?? '',
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
  sources: '',
  endpoints: app?.function?.mapping
    ? Object.entries(app.function.mapping).map(([label, value]) => ({
        label,
        value,
      }))
    : [],
  env: app?.function?.env
    ? Object.entries(app.function.env).map(([label, value]) => ({
        label,
        value,
      }))
    : [],
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
  };
  if (type === ApplicationType.CUSTOM_APP) {
    preparedData.features = formData.features
      ? JSON.parse(formData.features)
      : null;
    preparedData.maxInputAttachments = formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined;
  }
  if (type === ApplicationType.QUICK_APP) {
    preparedData.description = createQuickAppConfig({
      description: formData.description ?? '',
      config: formData.toolset,
      instructions: formData.instructions ?? '',
      temperature: formData.temperature,
      name: formData.name.trim(),
    });
    preparedData.completionUrl = `http://quickapps.dial-development.svc.cluster.local/openai/deployments/${encodeURIComponent(formData.name.trim())}/chat/completions`;
  }

  if (type === ApplicationType.EXECUTABLE) {
    preparedData.function = {
      source_folder: formData.sources,
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
