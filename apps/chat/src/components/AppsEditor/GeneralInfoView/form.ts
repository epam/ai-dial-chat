import { Path, RegisterOptions } from 'react-hook-form';

import { notAllowedSymbols } from '@/src/utils/app/file';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { QuickAppConfig } from '@/src/types/quick-apps';

import { DEFAULT_VERSION } from '@/src/constants/public';

import { DynamicField } from '../../Common/Forms/DynamicFormFields';

export interface ApplicationGeneralInfoFormData {
  name: string;
  version: string;
  iconUrl: string;
  description: string;
  topics: string[];
  completionUrl: string;
  id: string;
  reference: string;
  applicationProperties?: Record<string, unknown> | QuickAppConfig | null;
  inputAttachmentTypes?: string[];
  maxInputAttachments?: number;
  features?: string | null;
  env?: DynamicField[];
  sources?: string;
  sourceFiles?: string[];
  runtime?: string;
  endpoints?: DynamicField[];
}

type Options<T extends Path<ApplicationGeneralInfoFormData>> = Omit<
  RegisterOptions<ApplicationGeneralInfoFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof ApplicationGeneralInfoFormData]?: Options<K>;
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
};

export const getApplicationData = (
  formData: ApplicationGeneralInfoFormData,
  type: string,
  schema: ApiDetailedApplicationTypeSchema | null,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  const preparedData: Omit<CustomApplicationModel, 'id' | 'reference'> = {
    name: formData.name.trim(),
    applicationTypeSchemaId: schema?.$id ?? undefined,
    type: EntityType.Application,
    isDefault: false,
    folderId: '',
    topics: formData.topics,
    description: formData.description.trim(),
    completionUrl: formData.completionUrl,
    version: formData.version || DEFAULT_VERSION,
    iconUrl: formData.iconUrl,
    applicationProperties: formData.applicationProperties ?? undefined,
    inputAttachmentTypes: formData.inputAttachmentTypes,
    maxInputAttachments: formData.maxInputAttachments,
  };
  if (type === 'custom-app') {
    preparedData.completionUrl = formData.completionUrl ?? '';
    preparedData.features = formData.features
      ? JSON.parse(formData.features)
      : null;
  }

  if (type === 'code-app') {
    preparedData.function = {
      runtime: formData.runtime,
      env: formData.env?.length
        ? formData.env.reduce(
            (acc, option) => ({
              ...acc,
              [option.label]: option.value,
            }),
            {},
          )
        : undefined,
      sourceFolder: formData.sources!,
      mapping:
        formData.endpoints?.reduce(
          (acc, option) => ({
            ...acc,
            [option.label]: option.value.trim(),
          }),
          {},
        ) ?? {},
    };
  }

  return preparedData;
};
