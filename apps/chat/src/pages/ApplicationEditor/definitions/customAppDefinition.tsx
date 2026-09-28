import {
  SEMVER_VERSION_PATTERN,
  type DeploymentCreationFormValues,
} from '@epam/ai-dial-builder-form';
import type {
  CreateApplicationBodyDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  composeLocalePayload,
  isValidAbsoluteUrl,
  isValidFeaturesData,
  parseFeaturesData,
} from '@epam/ai-dial-chat-hooks';
import type { TFunction } from 'i18next';
import {
  DEFAULT_CUSTOM_APP_GENERAL_FORM,
  DEFAULT_CUSTOM_APP_SETTINGS_FORM,
  MIME_TYPE_REGEX,
} from '../../../constants/custom-apps';
import { ToolsetEditorQuery } from '../../../constants/toolsets';
import {
  CustomAppI18nKeys,
  EditorI18nKeys,
} from '../../../constants/translation-keys';
import type { ApplicationSetupErrors } from '../../../models/application-editor';
import type { CustomAppFormData } from '../../../models/custom-apps';
import {
  createApplication,
  updateApplication,
} from '../../../server-api/applications';
import { getDeploymentDetails } from '../../../server-api/deployments';
import {
  ApplicationCreateStrategy,
  ApplicationEditorKind,
} from '../../../types/application-editor';
import { NotifiableEntity } from '../../../types/entity-notification';
import { defineApplicationEditor } from '../../../utils/application-editor';
import { PRIMARY_LOCALE } from '../../../utils/locale';
import CustomAppSetup from '../setup/CustomAppSetup';

const getMetadataLabelOverrides = (t: TFunction) => ({
  name: {
    label: t(EditorI18nKeys.NameLabel),
    placeholder: t(CustomAppI18nKeys.NamePlaceholder),
  },
  description: {
    label: t(EditorI18nKeys.DescriptionLabel),
    placeholder: t(CustomAppI18nKeys.DescriptionPlaceholder),
  },
});

const validateSetup = (
  setup: CustomAppFormData,
  t: TFunction,
): ApplicationSetupErrors<CustomAppFormData> => {
  const errors: ApplicationSetupErrors<CustomAppFormData> = {};
  const trimmedUrl = setup.completionUrl.trim();
  if (!trimmedUrl) {
    errors.completionUrl = t(CustomAppI18nKeys.CompletionUrlRequired);
  } else if (!isValidAbsoluteUrl(trimmedUrl)) {
    errors.completionUrl = t(CustomAppI18nKeys.CompletionUrlInvalid);
  }
  if (setup.inputAttachmentTypes.some((tag) => !MIME_TYPE_REGEX.test(tag))) {
    errors.inputAttachmentTypes = t(CustomAppI18nKeys.InvalidMimeType);
  }
  return errors;
};

const loadSetup = async (
  appId: string,
  deployment: DeploymentItemDto | undefined,
): Promise<CustomAppFormData> => {
  const dto = await getDeploymentDetails(appId);
  const customAppFeatures = dto.applicationDetails?.customAppFeatures;
  return {
    completionUrl: dto.applicationDetails?.endpoint ?? '',
    featuresData: customAppFeatures
      ? JSON.stringify(customAppFeatures, null, '\t')
      : '',
    inputAttachmentTypes:
      dto.applicationDetails?.inputAttachmentTypes ??
      deployment?.inputAttachmentTypes ??
      [],
    maxInputAttachments:
      dto.applicationDetails?.maxInputAttachments ??
      deployment?.maxInputAttachments ??
      '',
  };
};

const toLocaleFields = (metadata: DeploymentCreationFormValues) => {
  const locales = composeLocalePayload(metadata.otherLocales, PRIMARY_LOCALE);
  return { locales, primaryLocale: locales ? PRIMARY_LOCALE : undefined };
};

const create = async (
  metadata: DeploymentCreationFormValues,
  setup: CustomAppFormData,
) => {
  const appProperties: Record<string, unknown> = {
    endpoint: setup.completionUrl,
    inputAttachmentTypes:
      setup.inputAttachmentTypes.length > 0
        ? setup.inputAttachmentTypes
        : undefined,
    maxInputAttachments:
      setup.maxInputAttachments !== '' ? setup.maxInputAttachments : undefined,
  };
  const parsedFeatures = parseFeaturesData(setup.featuresData);
  if (parsedFeatures !== undefined) {
    appProperties.features = parsedFeatures;
  }
  const body: CreateApplicationBodyDto = {
    name: metadata.name,
    description: metadata.description || undefined,
    iconUrl: metadata.iconUrl || undefined,
    version: metadata.version || undefined,
    topics: metadata.topics,
    applicationProperties: appProperties,
    ...toLocaleFields(metadata),
  };
  return createApplication(body);
};

const update = (
  appId: string,
  metadata: DeploymentCreationFormValues,
  setup: CustomAppFormData,
) =>
  updateApplication(appId, {
    name: metadata.name,
    description: metadata.description || undefined,
    iconUrl: metadata.iconUrl || undefined,
    version: metadata.version || undefined,
    topics: metadata.topics,
    endpoint: setup.completionUrl.trim() || undefined,
    features: parseFeaturesData(setup.featuresData),
    inputAttachmentTypes:
      setup.inputAttachmentTypes.length > 0
        ? setup.inputAttachmentTypes
        : undefined,
    maxInputAttachments:
      typeof setup.maxInputAttachments === 'number'
        ? setup.maxInputAttachments
        : undefined,
    ...toLocaleFields(metadata),
  });

/** Schema-less custom application: Metadata plus completion URL, features, and attachment limits. */
export const customAppDefinition = defineApplicationEditor<CustomAppFormData>({
  kind: ApplicationEditorKind.CustomApp,
  notifiableEntity: NotifiableEntity.CustomApp,
  createStrategy: ApplicationCreateStrategy.AllAtOnce,
  idQueryParam: ToolsetEditorQuery.Id,
  returnUrlQueryParam: ToolsetEditorQuery.ReturnUrl,
  messageKeys: {
    createTitle: CustomAppI18nKeys.CreateTitle,
    editTitle: CustomAppI18nKeys.EditTitle,
    createFailed: CustomAppI18nKeys.ErrorCreateFailed,
    saveFailed: CustomAppI18nKeys.ErrorSaveFailed,
    loadFailed: CustomAppI18nKeys.ErrorLoadFailed,
    savingOverlay: CustomAppI18nKeys.SavingOverlayLabel,
    loadingOverlay: CustomAppI18nKeys.LoadingOverlayLabel,
  },
  metadataValidation: { validateVersionPattern: SEMVER_VERSION_PATTERN },
  getMetadataLabelOverrides,
  defaultMetadata: DEFAULT_CUSTOM_APP_GENERAL_FORM,
  defaultSetup: DEFAULT_CUSTOM_APP_SETTINGS_FORM,
  loadSetup,
  validateSetup,
  needsConfirmation: (setup) => !isValidFeaturesData(setup.featuresData),
  confirmation: {
    titleKey: CustomAppI18nKeys.SaveConfirmTitle,
    descriptionKey: CustomAppI18nKeys.SaveConfirmDescription,
    confirmKey: CustomAppI18nKeys.SaveConfirmLabel,
  },
  Setup: CustomAppSetup,
  create,
  update,
});
