import { errorsMessages } from '@/src/constants/errors';

export const getEntityNameError = (
  isNameInvalid: boolean,
  isPathInvalid: boolean,
  isExternal: boolean,
) => {
  if (isNameInvalid) {
    return isExternal
      ? errorsMessages.entityNameInvalidExternal
      : errorsMessages.entityNameInvalid;
  } else if (isPathInvalid) {
    return isExternal
      ? errorsMessages.entityPathInvalidExternal
      : errorsMessages.entityPathInvalid;
  }
  return '';
};
