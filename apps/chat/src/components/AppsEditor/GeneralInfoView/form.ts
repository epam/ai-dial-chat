import { Path, RegisterOptions } from 'react-hook-form';

import { notAllowedSymbols } from '@/src/utils/app/file';

import {
  ApplicationSlug,
  CustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';

import { DEFAULT_VERSION } from '@/src/constants/public';

export interface FormData {
  name: string;
  version: string;
  iconUrl: string;
  description: string;
  topics: string[];
  completionUrl: string;
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
};

export const getApplicationData = (
  formData: FormData,
  _type: ApplicationSlug,
): Omit<CustomApplicationModel, 'id' | 'reference'> => {
  const preparedData: Omit<CustomApplicationModel, 'id' | 'reference'> = {
    name: formData.name.trim(),
    type: EntityType.Application,
    isDefault: false,
    folderId: '',
    topics: formData.topics,
    description: formData.description.trim(),
    completionUrl: formData.completionUrl ?? '',
    version: formData.version || DEFAULT_VERSION,
    iconUrl: formData.iconUrl,
  };

  return preparedData;
};
