import {
  SEMVER_VERSION_PATTERN,
  type DeploymentCreationFormValues,
} from '@epam/ai-dial-builder-form';
import {
  appendLocaleCode,
  composeLocalePayload,
} from '@epam/ai-dial-chat-hooks';
import type { TFunction } from 'i18next';
import {
  AppsEditorI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import type {
  ApplicationEditorContext,
  ApplicationSetupErrors,
  SchemaApplicationSetup,
} from '../../../models/application-editor';
import {
  createApplication,
  updateApplication,
} from '../../../server-api/applications';
import { getDeploymentDetails } from '../../../server-api/deployments';
import {
  ApplicationCreateStrategy,
  ApplicationEditorKind,
} from '../../../types/application-editor';
import { AppsEditorQuery } from '../../../types/apps-editor';
import { NotifiableEntity } from '../../../types/entity-notification';
import {
  defineApplicationEditor,
  getMissingRequiredProperties,
  resolveSchemaNotificationTarget,
} from '../../../utils/application-editor';
import { PRIMARY_LOCALE } from '../../../utils/locale';
import SchemaAppSetup from '../setup/SchemaAppSetup';

const EMPTY_METADATA: DeploymentCreationFormValues = {
  name: '',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

const EMPTY_SETUP: SchemaApplicationSetup = { requiredProperties: [] };

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

const toLocaleFields = (metadata: DeploymentCreationFormValues) => {
  const locales = composeLocalePayload(metadata.otherLocales, PRIMARY_LOCALE);
  return { locales, primaryLocale: locales ? PRIMARY_LOCALE : undefined };
};

const loadSetup = async (appId: string): Promise<SchemaApplicationSetup> => {
  const dto = await getDeploymentDetails(appId);
  return {
    properties: dto.applicationDetails?.applicationProperties ?? {},
    requiredProperties: [],
  };
};

const validateSetup = (
  setup: SchemaApplicationSetup,
  t: TFunction,
): ApplicationSetupErrors<SchemaApplicationSetup> =>
  getMissingRequiredProperties(setup.properties, setup.requiredProperties)
    .length > 0
    ? { properties: t(AppsEditorI18nKeys.SchemaFormRequiredMissing) }
    : {};

const create = (
  metadata: DeploymentCreationFormValues,
  setup: SchemaApplicationSetup,
  ctx: ApplicationEditorContext,
) =>
  createApplication({
    name: metadata.name.trim(),
    type: getSchemaId(ctx),
    description: metadata.description.trim() || undefined,
    iconUrl: metadata.iconUrl.trim() || undefined,
    version: metadata.version.trim() || undefined,
    topics: metadata.topics.length > 0 ? metadata.topics : undefined,
    applicationProperties: setup.properties ?? {},
    ...toLocaleFields(metadata),
  });

const update = (
  appId: string,
  metadata: DeploymentCreationFormValues,
  setup: SchemaApplicationSetup,
) =>
  updateApplication(appId, {
    name: metadata.name.trim(),
    description: metadata.description.trim() || undefined,
    iconUrl: metadata.iconUrl.trim() || undefined,
    version: metadata.version.trim() || undefined,
    topics: metadata.topics,
    applicationProperties: setup.properties ?? {},
    ...toLocaleFields(metadata),
  });

/** Schema-based application without an embedded editor: Metadata plus a form rendered from the schema, created in one request. */
export const schemaAppDefinition =
  defineApplicationEditor<SchemaApplicationSetup>({
    kind: ApplicationEditorKind.SchemaApp,
    notifiableEntity: NotifiableEntity.QuickApp,
    getNotificationTarget: resolveSchemaNotificationTarget,
    createStrategy: ApplicationCreateStrategy.AllAtOnce,
    idQueryParam: AppsEditorQuery.AppId,
    messageKeys: {
      createTitle: AppsEditorI18nKeys.CreateTitle,
      editTitle: AppsEditorI18nKeys.EditTitle,
      createFailed: AppsEditorI18nKeys.ErrorCreateFailed,
      saveFailed: AppsEditorI18nKeys.ErrorSaveFailed,
      loadFailed: AppsEditorI18nKeys.SchemaFormLoadFailed,
      savingOverlay: AppsEditorI18nKeys.SavingOverlayLabel,
      loadingOverlay: AppsEditorI18nKeys.SettingsStepLoadingLabel,
    },
    getTitle,
    metadataValidation: {
      validateNamePattern: true,
      validateVersionPattern: SEMVER_VERSION_PATTERN,
    },
    getMetadataLabelOverrides,
    defaultMetadata: EMPTY_METADATA,
    defaultSetup: EMPTY_SETUP,
    loadSetup,
    validateSetup,
    Setup: SchemaAppSetup,
    create,
    update,
  });
