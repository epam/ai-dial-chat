import { notAllowedSymbols } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { MIN_ENTITY_LENGTH } from './default-ui-settings';

export const formErrors = {
  required: translate('This field is required'),
  notValidString: (name = 'Name') =>
    translate(
      `${name} cannot be empty, too long, or contain special characters.`,
    ),
  hasSpecialCharacters: (name = 'Name') =>
    translate(
      `${name} should not contain special symbols ${notAllowedSymbols}`,
    ),
  tooShort: (name = 'Name', minLength = MIN_ENTITY_LENGTH) =>
    translate(`${name} should be at least ${minLength} characters long`),
  tooLong: (name = 'Name') =>
    translate(`The ${name} is too long. Please shorten it and try again.`),
  noDotInTheEnd: (name = 'Name') =>
    translate(`Using a dot at the end of a ${name} is not permitted.`),
  noDotInTheStart: (name = 'Name') =>
    translate(`Using a dot at the start of a ${name} is not permitted.`),
  notUniqName: (name = 'Name', newName: string) =>
    translate(`${name} "{{newName}}" already exists in this folder.`, {
      ns: Translation.Errors,
      newName,
    }),
};

export const urlErrors = {
  notValidUrl: translate('URL is not correct'),
  notValidProtocol: translate('URL must start with a valid protocol'),
  notValidEnding: translate('Endpoint cannot end with . or //'),
};

export const versionsErrors = {
  required: 'Version is required',
  notValid: 'Version format is invalid (example: 0.0.1)',
  versionExists: 'This version already exists',
  tooLongPart:
    'Each part of the version should contain no more than five numbers.',
};
