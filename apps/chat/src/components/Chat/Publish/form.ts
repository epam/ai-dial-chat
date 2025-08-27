import { Path, RegisterOptions } from 'react-hook-form';

import { createFormValidationRules } from '@/src/utils/app/forms';

import '@/src/constants/default-ui-settings';

export enum PublishRequestFieldsNames {
  PUBLISH_REQUEST_NAME = 'publishRequestName',
  PUBLICATION_AUTHOR = 'publicationAuthor',
}
export interface PublicationRequestFormData {
  [PublishRequestFieldsNames.PUBLISH_REQUEST_NAME]: string;
  [PublishRequestFieldsNames.PUBLICATION_AUTHOR]: string;
}

type Options<T extends Path<PublicationRequestFormData>> = Omit<
  RegisterOptions<PublicationRequestFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

export type Validators = {
  [K in keyof PublicationRequestFormData]?: Options<K>;
};

export const publishRequestFields = {
  [PublishRequestFieldsNames.PUBLISH_REQUEST_NAME]: {
    name: PublishRequestFieldsNames.PUBLISH_REQUEST_NAME,
    label: 'Request name',
    checkDotsInTheEnd: true,
  },
  [PublishRequestFieldsNames.PUBLICATION_AUTHOR]: {
    name: PublishRequestFieldsNames.PUBLICATION_AUTHOR,
    label: 'Author',
  },
};

export const validators: Validators = createFormValidationRules(
  Object.values(publishRequestFields),
);
