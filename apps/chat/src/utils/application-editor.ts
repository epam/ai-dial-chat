import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  composeLocalePayload,
  decomposeLocalizedFields,
  isQuickAppSchema,
} from '@epam/ai-dial-chat-hooks';
import type { JsonSchema } from '@epam/ai-dial-ui-kit';
import type {
  ApplicationEditorContext,
  ApplicationEditorDefinition,
  ApplicationNotificationTarget,
  ApplicationEditorFormDefinition,
  ApplicationEditorPageDefinition,
  ApplicationSetupValues,
} from '../models/application-editor';
import { ApplicationEditorKind } from '../types/application-editor';
import { AppsEditorQuery } from '../types/apps-editor';
import type { TriggerSaveGeneralPayload } from '../types/apps-editor';
import { NotifiableEntity } from '../types/entity-notification';
import { PRIMARY_LOCALE, resolveLocalizedText } from './locale';

/** Erases a kind's setup type so it can sit in the shared registry. */
export const defineApplicationEditor = <TSetup extends ApplicationSetupValues>(
  definition: ApplicationEditorFormDefinition<TSetup>,
): ApplicationEditorFormDefinition<ApplicationSetupValues> =>
  definition as unknown as ApplicationEditorFormDefinition<ApplicationSetupValues>;

/** Returns the kind that edits apps of `schemaId`: a schema with an editor URL uses its embedded editor, any other schema the schema form. */
export const resolveSchemaEditorKind = (
  schemas: ApplicationSchemaSummaryDto[],
  schemaId: string | null,
): ApplicationEditorKind => {
  const schema = schemas.find((item) => item.id === schemaId);
  return schema && !schema.editorUrl
    ? ApplicationEditorKind.SchemaApp
    : ApplicationEditorKind.QuickApp;
};

/** Returns what a schema app's notifications name: quick app for the QuickApp schema, the schema's display name for any other known schema, else the generic application (agent). */
export const resolveSchemaNotificationTarget = ({
  searchParams,
  schemas,
}: ApplicationEditorContext): ApplicationNotificationTarget => {
  const schemaId = searchParams.get(AppsEditorQuery.Schema);
  const schema = schemas.find((item) => item.id === schemaId) ?? {
    id: schemaId ?? undefined,
  };
  if (isQuickAppSchema(schema)) return { entity: NotifiableEntity.QuickApp };
  return schema.displayName
    ? { entity: NotifiableEntity.SchemaApp, type: schema.displayName }
    : { entity: NotifiableEntity.Agent };
};

/**
 * Returns the required property names that have no value: absent, `null` or an
 * empty string. Matches the rule `DialSchemaRenderer` marks a required field
 * invalid by, so every field that blocks a save is also highlighted.
 */
export const getMissingRequiredProperties = (
  properties: Record<string, unknown> | undefined,
  requiredProperties: string[],
): string[] =>
  requiredProperties.filter((name) => {
    const value = properties?.[name];
    return value == null || value === '';
  });

/** Returns the `default` of every top-level property of `schema` that declares one. */
export const getSchemaTopLevelDefaults = (
  schema: JsonSchema,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(schema.properties ?? {}).flatMap(([name, property]) =>
      property.default === undefined ? [] : [[name, property.default]],
    ),
  );

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
