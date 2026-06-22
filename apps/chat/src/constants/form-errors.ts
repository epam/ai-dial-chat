import { notAllowedSymbols } from '@/src/utils/app/file';
import { translateFormError } from '@/src/utils/app/translateFormError';

import { MIN_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import { ErrorsI18nKeys } from '@/src/constants/i18n';

export const formErrors = {
  get required() {
    return translateFormError(ErrorsI18nKeys.ThisFieldIsRequired);
  },
  notValidString: (
    name = 'Name',
    minLength = MIN_ENTITY_LENGTH,
    maxLength = 128,
  ) =>
    translateFormError(ErrorsI18nKeys.NameShouldBeMinToMaxCharsNoSpecial, {
      name,
      minLength,
      maxLength,
    }),
  hasSpecialCharacters: (name = 'Name') =>
    translateFormError(ErrorsI18nKeys.NameShouldNotContainSpecialSymbols, {
      name,
      notAllowedSymbols,
    }),
  tooShort: (name = 'Name', minLength = MIN_ENTITY_LENGTH) =>
    translateFormError(ErrorsI18nKeys.NameShouldBeAtLeastChars, {
      name,
      minLength,
    }),
  tooLong: (name = 'Name') =>
    translateFormError(ErrorsI18nKeys.NameIsTooLong, { name }),
  noDotInTheEnd: (name = 'Name') =>
    translateFormError(ErrorsI18nKeys.DotAtEndOfNameNotPermitted, { name }),
  noDotInTheStart: (name = 'Name') =>
    translateFormError(ErrorsI18nKeys.DotAtStartOfNameNotPermitted, { name }),
  notUniqName: (name = 'Name', newName: string) =>
    translateFormError(ErrorsI18nKeys.NameAlreadyExistsInFolder, {
      name,
      newName,
    }),
};

export const urlErrors = {
  get notValidUrl() {
    return translateFormError(ErrorsI18nKeys.UrlIsNotCorrect);
  },
  get notValidProtocol() {
    return translateFormError(ErrorsI18nKeys.UrlMustStartWithValidProtocol);
  },
  get notValidEnding() {
    return translateFormError(
      ErrorsI18nKeys.EndpointCannotEndWithDotOrDoubleSlash,
    );
  },
};

export const versionsErrors = {
  get required() {
    return translateFormError(ErrorsI18nKeys.VersionIsRequired);
  },
  get notValid() {
    return translateFormError(ErrorsI18nKeys.VersionFormatInvalid);
  },
  get versionExists() {
    return translateFormError(ErrorsI18nKeys.VersionAlreadyExists);
  },
  get tooLongPart() {
    return translateFormError(ErrorsI18nKeys.VersionPartTooLong);
  },
};
