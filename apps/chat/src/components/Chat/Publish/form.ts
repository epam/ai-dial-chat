import { Path, RegisterOptions } from 'react-hook-form';

import { validateStringField } from '@/src/utils/app/forms';

import { formErrors } from '@/src/constants/form-errors';

export interface PublicationRequestFormData {
  publishRequestName: string;
  publicationAuthor: string;
}

type Options<T extends Path<PublicationRequestFormData>> = Omit<
  RegisterOptions<PublicationRequestFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

export type Validators = {
  [K in keyof PublicationRequestFormData]?: Options<K>;
};

export const validators: Validators = {
  publishRequestName: {
    required: formErrors.required,
    validate: (valueToValidate) => {
      return (
        validateStringField({ valueToValidate }) ||
        formErrors.notValidString('Request name')
      );
    },
  },
  publicationAuthor: {
    required: formErrors.required,
    validate: (valueToValidate) => {
      return (
        validateStringField({ valueToValidate }) ||
        formErrors.notValidString('Author')
      );
    },
  },
};
