import { Path, RegisterOptions } from 'react-hook-form';

import { isApplicationType } from '@/src/utils/app/application';
import { notAllowedSymbols } from '@/src/utils/app/file';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';

import { DEFAULT_VERSION } from '@/src/constants/public';

export interface ApplicationGeneralInfoFormData {
  name: string;
  version: string;
  iconUrl: string;
  description: string;
  topics: string[];
  completionUrl: string;
  id: string;
  reference: string;
  applicationProperties: Record<string, any> | null;
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
    isDefault: true,
    folderId: '',
    topics: isApplicationType(type)
      ? [...formData.topics, type]
      : formData.topics,
    description: formData.description.trim(),
    completionUrl: formData.completionUrl,
    version: formData.version || DEFAULT_VERSION,
    iconUrl: formData.iconUrl,
    applicationProperties: formData.applicationProperties,
  };

  return preparedData;
};
