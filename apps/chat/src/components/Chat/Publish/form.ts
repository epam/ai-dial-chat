import { Path, RegisterOptions } from 'react-hook-form';

import { getNameReg } from '@/src/utils/app/forms';

import { formErrors } from '@/src/constants/form-errors';
import { MAX_PUBLICATION_AUTHOR_LENGTH } from '@/src/constants/publication';

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
    validate: (v) => {
      return (
        getNameReg().test(v.trim()) || formErrors.notValidString('Request name')
      );
    },
  },
  publicationAuthor: {
    required: formErrors.required,
    validate: (v) => {
      return (
        getNameReg(MAX_PUBLICATION_AUTHOR_LENGTH).test(v.trim()) ||
        formErrors.notValidString('Author', MAX_PUBLICATION_AUTHOR_LENGTH)
      );
    },
  },
};
