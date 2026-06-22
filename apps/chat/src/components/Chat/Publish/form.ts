import { zodValidation } from '@/src/utils/zod-config-wrapper';

import { PublicationFunctions } from '@/src/types/publication';

import '@/src/constants/default-ui-settings';
import { getEntityNameSchema } from '@/src/constants/validation-helpers';

export enum PublishRequestFieldsNames {
  PUBLISH_REQUEST_NAME = 'publishRequestName',
  PUBLICATION_AUTHOR = 'publicationAuthor',
  RULES = 'rules',
  PUBLISH_TO_URL = 'publishToUrl',
}

export const PublicationRequestFormSchema = zodValidation.object({
  [PublishRequestFieldsNames.PUBLISH_REQUEST_NAME]: getEntityNameSchema({
    name: 'Request name',
    skipCheckRestrictedSymbols: true,
  }),
  [PublishRequestFieldsNames.PUBLICATION_AUTHOR]: getEntityNameSchema({
    name: 'Author name',
    skipCheckRestrictedSymbols: true,
  }),
  [PublishRequestFieldsNames.RULES]: zodValidation.array(
    zodValidation.object({
      source: zodValidation.string(),
      targets: zodValidation.array(zodValidation.string()),
      function: zodValidation.enum(PublicationFunctions),
    }),
  ),
  [PublishRequestFieldsNames.PUBLISH_TO_URL]: zodValidation.string(),
});

export type PublicationRequestFormData = zodValidation.infer<
  typeof PublicationRequestFormSchema
>;
