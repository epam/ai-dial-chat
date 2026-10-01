import type {
  DeploymentCreationFormErrorCodes,
  DeploymentCreationFormFieldErrors,
} from '@epam/ai-dial-builder-form';
import { DeploymentCreationFieldErrorCode } from '@epam/ai-dial-builder-form';
import {
  ENTITY_DESCRIPTION_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
} from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import {
  AppsEditorI18nKeys,
  EditorI18nKeys,
} from '../constants/translation-keys';

/*
 * Codes that are reported while the user is still typing. A required-field
 * error waits for blur/submit so an empty field is not flagged the moment
 * it is focused; a too-long or control-character value is flagged at once.
 */
const LIVE_ERROR_CODES = new Set<DeploymentCreationFieldErrorCode>([
  DeploymentCreationFieldErrorCode.TooLong,
  DeploymentCreationFieldErrorCode.ControlCharacters,
]);

const translateNameCode = (
  code: DeploymentCreationFieldErrorCode,
  t: TFunction,
): string => {
  switch (code) {
    case DeploymentCreationFieldErrorCode.Required:
      return t(EditorI18nKeys.NameRequired);
    case DeploymentCreationFieldErrorCode.TooLong:
      return t(EditorI18nKeys.FieldTooLong, { count: ENTITY_NAME_MAX_LENGTH });
    case DeploymentCreationFieldErrorCode.ControlCharacters:
      return t(EditorI18nKeys.NameControlCharacters);
    case DeploymentCreationFieldErrorCode.InvalidFormat:
      return t(AppsEditorI18nKeys.GeneralFormNameInvalid);
  }
};

/** Translates `validateDeploymentCreationFields` codes into inline field messages; keys without an error are omitted. */
export const translateDeploymentCreationErrors = (
  codes: DeploymentCreationFormErrorCodes,
  t: TFunction,
): DeploymentCreationFormFieldErrors => {
  const errors: DeploymentCreationFormFieldErrors = {};
  if (codes.name) {
    errors.name = translateNameCode(codes.name, t);
  }
  if (codes.version) {
    errors.version = t(EditorI18nKeys.VersionInvalid);
  }
  if (codes.description) {
    errors.description = t(EditorI18nKeys.FieldTooLong, {
      count: ENTITY_DESCRIPTION_MAX_LENGTH,
    });
  }
  return errors;
};

/** Returns the as-you-type errors (too long, control characters) for the fields in `changedKeys`, keyed like the form's errors. */
export const getLiveDeploymentCreationErrors = (
  codes: DeploymentCreationFormErrorCodes,
  changedKeys: string[],
  t: TFunction,
): DeploymentCreationFormFieldErrors => {
  const liveCodes: DeploymentCreationFormErrorCodes = {};
  for (const key of ['name', 'description'] as const) {
    const code = codes[key];
    if (changedKeys.includes(key) && code && LIVE_ERROR_CODES.has(code)) {
      liveCodes[key] = code;
    }
  }
  return translateDeploymentCreationErrors(liveCodes, t);
};
