import { Validate } from 'react-hook-form';

import {
  getModelDescription,
  getQuickAppConfig,
} from '@/src/utils/app/application';
import { notAllowedSymbols } from '@/src/utils/app/file';

import { CustomApplicationModel } from '@/src/types/applications';
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
  maxInputAttachments: number | undefined;
  completionUrl: string;
  features: string | null;
  instructions: string;
  temperature: number;
  toolset: string;
}

type Validator = Partial<{
  required: string;
  validate: Validate<FormData[keyof FormData], Partial<FormData>>;
}>;

export const validators: Partial<Record<keyof FormData, Validator>> = {
  name: {
    required: 'This field is required',
    validate: (v) => {
      const reg = new RegExp(`^[^${notAllowedSymbols}]{2,160}$`);

      return (
        reg.test(v as string) ||
        'Name should be 2 to 160 characters long and should not contain special characters'
      );
    },
  },
  version: {
    required: 'This field is required',
    validate: (v) => {
      const reg = /^[0-9]+\.[0-9]+\.[0-9]+$/;

      return (
        reg.test(v as string) ||
        'Version should be in x.y.z format and contain only numbers and dots.'
      );
    },
  },
  iconUrl: {
    required: 'Icon is required',
  },
  features: {
    validate: (v) => {
      const data = v as string | null;

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
    validate: (v) => {
      const types = v as string[];
      const reg = new RegExp(
        '^([a-zA-Z0-9!*\\-.+]+|\\*)\\/([a-zA-Z0-9!*\\-.+]+|\\*)$',
      );

      return types.every((t) => reg.test(t)) || 'Please match the MIME format';
    },
  },
  maxInputAttachments: {
    validate: (v) => {
      const reg = /^[0-9]*$/;

      return reg.test(String(v)) || 'Max attachments must be a number';
    },
  },
  completionUrl: {
    required: 'Completion URL is required',
    validate: (v) => {
      const value = v as string;

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
        JSON.parse(v as string);
      } catch {
        return 'Config is not a valid JSON object';
      }
      return true;
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
  maxInputAttachments: app?.maxInputAttachments,
  completionUrl: app?.completionUrl ?? '',
  features: safeStringify(app?.features),
  instructions: app ? getQuickAppConfig(app).config.instructions : '',
  temperature: app
    ? getQuickAppConfig(app).config.temperature
    : DEFAULT_TEMPERATURE,
  toolset: app ? getToolsetStr(getQuickAppConfig(app).config) : '',
});
