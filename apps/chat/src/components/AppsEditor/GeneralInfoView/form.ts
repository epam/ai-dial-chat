import { Path, RegisterOptions } from 'react-hook-form';

import { safeStringifyApplicationFeatures } from '@/src/utils/app/application';
import { notAllowedSymbols } from '@/src/utils/app/file';
import { getNextDefaultName } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import {
  ApplicationStatus,
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { QuickAppConfig } from '@/src/types/quick-apps';

import {
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import { DEFAULT_APPLICATION_NAME } from '@/src/constants/default-ui-settings';
import { DEFAULT_VERSION } from '@/src/constants/public';

import { DynamicField } from '@/src/components/Common/Forms/DynamicFormFields';

import { ShareEntity } from '@epam/ai-dial-shared';

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
  maxInputAttachments?: number | '';
  features?: string | null;
  env?: DynamicField[];
  sources?: string;
  sourceFiles?: string[];
  runtime?: string;
  endpoints?: DynamicField[];
  functionStatus?: ApplicationStatus;
}

type Options<T extends Path<ApplicationGeneralInfoFormData>> = Omit<
  RegisterOptions<ApplicationGeneralInfoFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof ApplicationGeneralInfoFormData]?: Options<K>;
};

export const getDefaultValues = (
  applicationData?: CustomApplicationModel,
  bucket?: string,
  pythonVersion?: string,
  models?: ShareEntity[],
): ApplicationGeneralInfoFormData => {
  return {
    name:
      applicationData?.name ??
      getNextDefaultName(DEFAULT_APPLICATION_NAME, models ?? [], 0, true),
    version: applicationData?.version ?? DEFAULT_VERSION,
    iconUrl: applicationData?.iconUrl ?? '',
    description: applicationData?.description ?? '',
    topics: applicationData?.topics ?? [],
    id: applicationData?.name ? applicationData?.name : '',
    reference: applicationData?.reference ?? '',
    //schema type application properties
    applicationProperties: applicationData?.applicationProperties,
    //custom application properties
    completionUrl: applicationData?.completionUrl ?? '',
    inputAttachmentTypes: applicationData?.inputAttachmentTypes,
    maxInputAttachments: applicationData?.maxInputAttachments,
    features: safeStringifyApplicationFeatures(applicationData?.features),
    //code app application properties
    sources: applicationData?.function?.sourceFolder
      ? ApiUtils.decodeApiUrl(applicationData.function.sourceFolder)
      : `files/${bucket}`,
    runtime:
      applicationData?.function?.runtime ?? pythonVersion ?? 'python3.11',
    endpoints: applicationData?.function?.mapping
      ? Object.entries(applicationData.function.mapping).map(
          ([key, value]) => ({
            label: key,
            visibleName: FEATURES_ENDPOINTS_NAMES[key],
            value,
            editableKey:
              !FEATURES_ENDPOINTS[key as keyof typeof FEATURES_ENDPOINTS],
            static: key === FEATURES_ENDPOINTS.chat_completion,
          }),
        )
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
    env: applicationData?.function?.env
      ? Object.entries(applicationData.function.env).map(([label, value]) => ({
          label,
          value,
          editableKey: true,
        }))
      : [],
    functionStatus: applicationData?.function?.status,
  };
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

      if (!reg.test(v)) {
        return 'Version should be in x.y.z format and contain only numbers and dots.';
      }

      const parts = v.split('.');

      for (const part of parts) {
        if (part.length > 5) {
          return 'Each part of the version should contain no more than five numbers.';
        }
      }

      return true;
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
    maxInputAttachments: formData.maxInputAttachments
      ? Number(formData.maxInputAttachments)
      : undefined,
  };
  if (type === ApplicationType.CUSTOM_APP) {
    preparedData.completionUrl = formData.completionUrl ?? '';
    preparedData.features = formData.features
      ? JSON.parse(formData.features)
      : null;
  }

  if (type === ApplicationType.CODE_APP) {
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
