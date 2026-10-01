import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import {
  composeLocalePayload,
  decomposeLocalizedFields,
} from '@epam/ai-dial-chat-hooks';
import type {
  ApplicationEditorDefinition,
  ApplicationEditorFormDefinition,
  ApplicationEditorPageDefinition,
  ApplicationSetupValues,
} from '../models/application-editor';
import type { TriggerSaveGeneralPayload } from '../types/apps-editor';
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

/** Returns the trimmed Metadata payload a quick app's embedded editor persists on save; carries `display_version`, never the backend `version`. */
export const toTriggerSaveGeneral = (
  metadata: DeploymentCreationFormValues,
): TriggerSaveGeneralPayload => {
  const locales = composeLocalePayload(metadata.otherLocales, PRIMARY_LOCALE);
  return {
    name: metadata.name.trim(),
    description: metadata.description.trim() || undefined,
    iconUrl: metadata.iconUrl.trim() || undefined,
    topics: metadata.topics.length > 0 ? metadata.topics : undefined,
    display_version: metadata.version.trim() || undefined,
    locales,
    primaryLocale: locales ? PRIMARY_LOCALE : undefined,
  };
};
