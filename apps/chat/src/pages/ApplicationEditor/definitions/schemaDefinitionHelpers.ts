import type { DeploymentCreationFormValues } from '@epam/ai-dial-builder-form';
import {
  appendLocaleCode,
  composeLocalePayload,
} from '@epam/ai-dial-chat-hooks';
import type { TFunction } from 'i18next';
import {
  AppsEditorI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import type { ApplicationEditorContext } from '../../../models/application-editor';
import { AppsEditorQuery } from '../../../types/apps-editor';
import { PRIMARY_LOCALE } from '../../../utils/locale';

/* Shared by the schema-based kinds (the embedded-editor quick app and the
   schema form), which differ only in their Setup and how they persist it. */

export const SCHEMA_APP_EMPTY_METADATA: DeploymentCreationFormValues = {
  name: '',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

/** Name and description labels tagged with the primary locale, with schema-app placeholders. */
export const getSchemaAppMetadataLabelOverrides = (t: TFunction) => ({
  name: {
    label: appendLocaleCode(t(EditorI18nKeys.NameLabel), PRIMARY_LOCALE),
    placeholder: t(AppsEditorI18nKeys.GeneralFormNamePlaceholder),
  },
  description: {
    label: appendLocaleCode(t(EditorI18nKeys.DescriptionLabel), PRIMARY_LOCALE),
    placeholder: t(AppsEditorI18nKeys.GeneralFormDescriptionPlaceholder),
  },
});

/** Returns the schema id of the edited application from the page's query. */
export const getSchemaId = ({
  searchParams,
}: ApplicationEditorContext): string =>
  searchParams.get(AppsEditorQuery.Schema) ?? '';

/** Returns the page title naming the schema's display name, or the default type name when it is unknown. */
export const getSchemaAppTitle = (
  ctx: ApplicationEditorContext,
  isEditMode: boolean,
) => {
  const schemaId = getSchemaId(ctx);
  const schema = ctx.schemas.find((item) => item.id === schemaId);
  const type = schema?.displayName || ctx.t(AppsEditorI18nKeys.DefaultTypeName);
  return isEditMode
    ? ctx.t(AppsEditorI18nKeys.EditTitle, { type })
    : ctx.t(AppsEditorI18nKeys.CreateTitle, { type });
};

/** Returns the `locales` and `primaryLocale` request fields of the Metadata's other locales. */
export const toLocaleFields = (metadata: DeploymentCreationFormValues) => {
  const locales = composeLocalePayload(metadata.otherLocales, PRIMARY_LOCALE);
  return { locales, primaryLocale: locales ? PRIMARY_LOCALE : undefined };
};
