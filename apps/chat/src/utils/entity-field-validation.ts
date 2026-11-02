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
    errors.version = t(AppsEditorI18nKeys.GeneralFormVersionInvalid);
  }
  if (codes.description) {
    errors.description = t(EditorI18nKeys.FieldTooLong, {
      count: ENTITY_DESCRIPTION_MAX_LENGTH,
    });
  }
  return errors;
};
