import { notAllowedSymbols } from '@/src/utils/app/file';

import { MAX_ENTITY_LENGTH, MIN_ENTITY_LENGTH } from './default-ui-settings';

export const formErrors = {
  required: 'This field is required',
  notValidUrl: 'URL is not correct',
  notValidString: (name = 'Name', maxLength = MAX_ENTITY_LENGTH) =>
    `${name} should be ${MIN_ENTITY_LENGTH} to ${maxLength} characters long and should not contain special characters`,
  hasSpecialCharacters: (name = 'Name') =>
    `${name} should not contain special symbols ${notAllowedSymbols}`,
  tooShort: (name = 'Name', minLength = MIN_ENTITY_LENGTH) =>
    `${name} should be at least ${minLength} characters long`,
  tooLong: (name = 'Name', maxLength = MAX_ENTITY_LENGTH) =>
    `${name} should be at most ${maxLength} characters long`,
  noDotInTheEnd: (name = 'Name') =>
    `Using a dot at the end of a ${name} is not permitted.`,
};

export const versionsErrors = {
  required: 'Version is required',
  notValid: 'Version format is invalid (example: 0.0.1)',
  versionExists: 'This version already exists',
  tooLongPart:
    'Each part of the version should contain no more than five numbers.',
};
