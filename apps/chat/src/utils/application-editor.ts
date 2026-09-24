import {
  DeploymentCreationFieldErrorCode,
  type DeploymentCreationFormErrorCodes,
  type DeploymentCreationFormFieldErrors,
  type DeploymentCreationFormValues,
} from '@epam/ai-dial-builder-form';
import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { decomposeLocalizedFields } from '@epam/ai-dial-chat-hooks';
import type { TFunction } from 'i18next';
import {
  AppsEditorI18nKeys,
  EditorI18nKeys,
} from '../constants/translation-keys';
import type {
  ApplicationEditorDefinition,
  ApplicationEditorFormDefinition,
  ApplicationEditorPageDefinition,
  ApplicationSetupValues,
} from '../models/application-editor';
import { PRIMARY_LOCALE, resolveLocalizedText } from './locale';

/** Erases a kind's setup type so it can sit in the shared registry. */
export const defineApplicationEditor = <TSetup extends ApplicationSetupValues>(
  definition: ApplicationEditorFormDefinition<TSetup>,
): ApplicationEditorFormDefinition<ApplicationSetupValues> =>
  definition as unknown as ApplicationEditorFormDefinition<ApplicationSetupValues>;

/** Returns whether a registered kind renders its own page body. */
export const isApplicationEditorPageDefinition = (
  definition: ApplicationEditorDefinition,
): definition is ApplicationEditorPageDefinition => 'renderPage' in definition;

/** Returns the Metadata values of an existing deployment, on top of a kind's defaults. */
export const deploymentToMetadata = (
  deployment: DeploymentItemDto,
  defaults: DeploymentCreationFormValues,
): DeploymentCreationFormValues => ({
  ...defaults,
  name: resolveLocalizedText(deployment.displayName, PRIMARY_LOCALE),
  description: resolveLocalizedText(deployment.description, PRIMARY_LOCALE),
  iconUrl: deployment.iconUrl ?? '',
  version: deployment.displayVersion ?? '',
  topics: deployment.topics ?? [],
  otherLocales: decomposeLocalizedFields(
    deployment.displayName,
    deployment.description,
    PRIMARY_LOCALE,
  ),
});

/** Returns the translated Metadata messages for the given validation codes. */
export const toMetadataErrorMessages = (
  codes: DeploymentCreationFormErrorCodes,
  t: TFunction,
): DeploymentCreationFormFieldErrors => {
  const errors: DeploymentCreationFormFieldErrors = {};
  if (codes.name === DeploymentCreationFieldErrorCode.Required) {
    errors.name = t(EditorI18nKeys.NameRequired);
  } else if (codes.name === DeploymentCreationFieldErrorCode.InvalidFormat) {
    errors.name = t(AppsEditorI18nKeys.GeneralFormNameInvalid);
  }
  if (codes.version === DeploymentCreationFieldErrorCode.InvalidFormat) {
    errors.version = t(AppsEditorI18nKeys.GeneralFormVersionInvalid);
  }
  return errors;
};

/** Returns a same-origin return path from a query value, or the fallback. */
export const resolveReturnUrl = (
  raw: string | null,
  fallback: string,
): string => (raw?.startsWith('/') && !raw.startsWith('//') ? raw : fallback);
