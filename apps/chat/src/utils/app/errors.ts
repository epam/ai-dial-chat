import { translateErrorMessage } from '@/src/utils/app/translateErrorMessage';

import { errorsMessages } from '@/src/constants/errors';

export const getEntityNameError = (
  isNameInvalid: boolean,
  isPathInvalid: boolean,
  isExternal: boolean,
) => {
  if (isNameInvalid) {
    return translateErrorMessage(
      isExternal
        ? errorsMessages.entityNameInvalidExternal
        : errorsMessages.entityNameInvalid,
    );
  } else if (isPathInvalid) {
    return translateErrorMessage(
      isExternal
        ? errorsMessages.entityPathInvalidExternal
        : errorsMessages.entityPathInvalid,
    );
  }
  return '';
};
