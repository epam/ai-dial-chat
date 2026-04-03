import { notAllowedSymbols } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { ErrorsI18nKeys } from '@/src/constants/i18n';

import { MAX_ENTITY_LENGTH, MIN_ENTITY_LENGTH } from './default-ui-settings';

export const formErrors = {
  required: translate(ErrorsI18nKeys.ThisFieldIsRequired, {
    ns: Translation.Errors,
  }),
  notValidString: (name = 'Name', maxLength = MAX_ENTITY_LENGTH) =>
    translate(ErrorsI18nKeys.NameShouldBeMinToMaxCharsNoSpecial, {
      ns: Translation.Errors,
      name,
      minLength: MIN_ENTITY_LENGTH,
      maxLength,
    }),
  hasSpecialCharacters: (name = 'Name') =>
    translate(ErrorsI18nKeys.NameShouldNotContainSpecialSymbols, {
      ns: Translation.Errors,
      name,
      notAllowedSymbols,
    }),
  tooShort: (name = 'Name', minLength = MIN_ENTITY_LENGTH) =>
    translate(ErrorsI18nKeys.NameShouldBeAtLeastChars, {
      ns: Translation.Errors,
      name,
      minLength,
    }),
  tooLong: (name = 'Name', maxLength = MAX_ENTITY_LENGTH) =>
    translate(ErrorsI18nKeys.NameShouldBeAtMostChars, {
      ns: Translation.Errors,
      name,
      maxLength,
    }),
  noDotInTheEnd: (name = 'Name') =>
    translate(ErrorsI18nKeys.DotAtEndOfNameNotPermitted, {
      ns: Translation.Errors,
      name,
    }),
  notUniqName: (name = 'Name', newName: string) =>
    translate(ErrorsI18nKeys.NameAlreadyExistsInFolder, {
      ns: Translation.Errors,
      name,
      newName,
    }),
};

export const urlErrors = {
  notValidUrl: translate(ErrorsI18nKeys.UrlIsNotCorrect, {
    ns: Translation.Errors,
  }),
  notValidProtocol: translate(ErrorsI18nKeys.UrlMustStartWithValidProtocol, {
    ns: Translation.Errors,
  }),
  notValidEnding: translate(
    ErrorsI18nKeys.EndpointCannotEndWithDotOrDoubleSlash,
    {
      ns: Translation.Errors,
    },
  ),
};

export const versionsErrors = {
  required: 'Version is required',
  notValid: 'Version format is invalid (example: 0.0.1)',
  versionExists: 'This version already exists',
  tooLongPart:
    'Each part of the version should contain no more than five numbers.',
};
