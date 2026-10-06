import {
  SEMVER_VERSION_PATTERN,
  type DeploymentCreationFormValues,
} from '@epam/ai-dial-builder-form';
import { isQuickAppSchema } from '@epam/ai-dial-chat-hooks';
import {
  AppsEditorI18nKeys,
  BasicI18nKeys,
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
import {
  defineApplicationEditor,
  resolveSchemaNotificationTarget,
} from '../../../utils/application-editor';
import QuickAppPreview from '../setup/QuickAppPreview';
import QuickAppSetup from '../setup/QuickAppSetup';
import {
  SCHEMA_APP_EMPTY_METADATA,
  getSchemaAppMetadataLabelOverrides,
  getSchemaAppTitle,
  getSchemaId,
  toLocaleFields,
} from './schemaDefinitionHelpers';

const EMPTY_SETUP: EmptyApplicationSetup = {};

/* Any schema with an embedded editor opens here; only the Quick Apps one can be previewed. */
const isPreviewAvailable = (ctx: ApplicationEditorContext) => {
  const schemaId = getSchemaId(ctx);
  return isQuickAppSchema(
    ctx.schemas.find((schema) => schema.id === schemaId) ?? { id: schemaId },
  );
};

/* Mirrors `QuickAppSetup`: the iframe renders only for a saved app whose schema has an editor. */
const isSetupEmbedded = (
  ctx: ApplicationEditorContext,
  appId: string | undefined,
) => {
  const schemaId = getSchemaId(ctx);
  return Boolean(
    appId && ctx.schemas.find((schema) => schema.id === schemaId)?.editorUrl,
  );
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
  const result = await createApplication({
    name: metadata.name.trim(),
    type: schemaId,
    description: metadata.description.trim() || undefined,
    iconUrl: metadata.iconUrl.trim() || undefined,
    version: metadata.version.trim() || undefined,
    topics: metadata.topics.length > 0 ? metadata.topics : undefined,
    applicationProperties,
    ...toLocaleFields(metadata),
  });
  return { id: result.id };
};

/** Schema-based application: Metadata first, then the schema's embedded editor as its Setup. */
export const quickAppDefinition =
  defineApplicationEditor<EmptyApplicationSetup>({
    kind: ApplicationEditorKind.QuickApp,
    notifiableEntity: NotifiableEntity.QuickApp,
    getNotificationTarget: resolveSchemaNotificationTarget,
    createStrategy: ApplicationCreateStrategy.MetadataFirst,
    idQueryParam: AppsEditorQuery.AppId,
    messageKeys: {
      createTitle: AppsEditorI18nKeys.CreateTitle,
      editTitle: AppsEditorI18nKeys.EditTitle,
      createFailed: AppsEditorI18nKeys.ErrorCreateFailed,
      saveFailed: AppsEditorI18nKeys.ErrorSaveFailed,
      loadFailed: AppsEditorI18nKeys.ErrorSaveFailed,
      savingOverlay: AppsEditorI18nKeys.SavingOverlayLabel,
      loadingOverlay: AppsEditorI18nKeys.SettingsStepLoadingLabel,
      preview: BasicI18nKeys.Preview,
    },
    getTitle: getSchemaAppTitle,
    metadataValidation: {
      validateNamePattern: true,
      validateVersionPattern: SEMVER_VERSION_PATTERN,
    },
    getMetadataLabelOverrides: getSchemaAppMetadataLabelOverrides,
    defaultMetadata: SCHEMA_APP_EMPTY_METADATA,
    defaultSetup: EMPTY_SETUP,
    validateSetup: () => ({}),
    Setup: QuickAppSetup,
    isSetupEmbedded,
    Preview: QuickAppPreview,
    isPreviewAvailable,
    create,
  });
