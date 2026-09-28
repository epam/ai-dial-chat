import {
  SEMVER_VERSION_PATTERN,
  type DeploymentCreationFormValues,
} from '@epam/ai-dial-builder-form';
import {
  appendLocaleCode,
  composeLocalePayload,
  isQuickAppSchema,
} from '@epam/ai-dial-chat-hooks';
import type { TFunction } from 'i18next';
import {
  AppsEditorI18nKeys,
  BasicI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import type {
  ApplicationEditorContext,
  EmptyApplicationSetup,
} from '../../../models/application-editor';
import { createApplication } from '../../../server-api/applications';
import {
  ApplicationCreateStrategy,
  ApplicationEditorKind,
} from '../../../types/application-editor';
import { AppsEditorQuery } from '../../../types/apps-editor';
import { NotifiableEntity } from '../../../types/entity-notification';
import { defineApplicationEditor } from '../../../utils/application-editor';
import { PRIMARY_LOCALE } from '../../../utils/locale';
import QuickAppSetup from '../setup/QuickAppSetup';

const EMPTY_METADATA: DeploymentCreationFormValues = {
  name: '',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

const EMPTY_SETUP: EmptyApplicationSetup = {};

const getMetadataLabelOverrides = (t: TFunction) => ({
  name: {
    label: appendLocaleCode(t(EditorI18nKeys.NameLabel), PRIMARY_LOCALE),
    placeholder: t(AppsEditorI18nKeys.GeneralFormNamePlaceholder),
  },
  description: {
    label: appendLocaleCode(t(EditorI18nKeys.DescriptionLabel), PRIMARY_LOCALE),
    placeholder: t(AppsEditorI18nKeys.GeneralFormDescriptionPlaceholder),
  },
});

const getSchemaId = ({ searchParams }: ApplicationEditorContext): string =>
  searchParams.get(AppsEditorQuery.Schema) ?? '';

const getTitle = (ctx: ApplicationEditorContext, isEditMode: boolean) => {
  const schemaId = getSchemaId(ctx);
  const schema = ctx.schemas.find((item) => item.id === schemaId);
  const type = schema?.displayName || ctx.t(AppsEditorI18nKeys.DefaultTypeName);
  return isEditMode
    ? ctx.t(AppsEditorI18nKeys.EditTitle, { type })
    : ctx.t(AppsEditorI18nKeys.CreateTitle, { type });
};

const create = async (
  metadata: DeploymentCreationFormValues,
  _setup: EmptyApplicationSetup,
  ctx: ApplicationEditorContext,
) => {
  const schemaId = getSchemaId(ctx);
  const applicationProperties = isQuickAppSchema({ id: schemaId })
    ? {
        orchestrator: {
          system_prompt: { type: 'custom', variables: {}, content: '' },
        },
        contexts: [],
        tool_sets: [],
      }
    : undefined;
  const locales = composeLocalePayload(metadata.otherLocales, PRIMARY_LOCALE);
  const result = await createApplication({
    name: metadata.name.trim(),
    type: schemaId,
    description: metadata.description.trim() || undefined,
    iconUrl: metadata.iconUrl.trim() || undefined,
    version: metadata.version.trim() || undefined,
    topics: metadata.topics.length > 0 ? metadata.topics : undefined,
    applicationProperties,
    locales,
    primaryLocale: locales ? PRIMARY_LOCALE : undefined,
  });
  return { id: result.id };
};

/** Schema-based application: Metadata first, then the schema's embedded editor as its Setup. */
export const quickAppDefinition =
  defineApplicationEditor<EmptyApplicationSetup>({
    kind: ApplicationEditorKind.QuickApp,
    notifiableEntity: NotifiableEntity.QuickApp,
    createStrategy: ApplicationCreateStrategy.MetadataFirst,
    idQueryParam: AppsEditorQuery.AppId,
    returnUrlQueryParam: AppsEditorQuery.ReturnUrl,
    messageKeys: {
      createTitle: AppsEditorI18nKeys.CreateTitle,
      editTitle: AppsEditorI18nKeys.EditTitle,
      createFailed: AppsEditorI18nKeys.ErrorCreateFailed,
      saveFailed: AppsEditorI18nKeys.ErrorSaveFailed,
      loadFailed: AppsEditorI18nKeys.ErrorSaveFailed,
      savingOverlay: AppsEditorI18nKeys.SavingOverlayLabel,
      loadingOverlay: AppsEditorI18nKeys.SettingsStepLoadingLabel,
      preview: BasicI18nKeys.Preview,
      exitPreview: AppsEditorI18nKeys.ExitPreviewButton,
    },
    getTitle,
    metadataValidation: {
      validateNamePattern: true,
      validateVersionPattern: SEMVER_VERSION_PATTERN,
    },
    getMetadataLabelOverrides,
    defaultMetadata: EMPTY_METADATA,
    defaultSetup: EMPTY_SETUP,
    validateSetup: () => ({}),
    Setup: QuickAppSetup,
    create,
  });
