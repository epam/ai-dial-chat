import { translate } from '@/src/utils/app/translation';

import { ApiKeys, ConfirmDialogValueTypes } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys, SettingsI18nKeys } from '@/src/constants/i18n';

export const FEATURES_ENDPOINTS = {
  chat_completion: 'chat_completion',
  rate: 'rate',
  configuration: 'configuration',
};

export const FEATURES_ENDPOINTS_NAMES = {
  [FEATURES_ENDPOINTS.chat_completion]: 'Chat Completion',
  [FEATURES_ENDPOINTS.rate]: 'Rate',
  [FEATURES_ENDPOINTS.configuration]: 'Configuration',
};

export const FEATURES_ENDPOINTS_DEFAULT_VALUES = {
  [FEATURES_ENDPOINTS.chat_completion]:
    '/openai/deployments/app/chat/completions',
  [FEATURES_ENDPOINTS.rate]: '/openai/deployments/app/rate',
  [FEATURES_ENDPOINTS.configuration]: '/openai/deployments/app/configure',
};
export enum CODEAPPS_REQUIRED_FILES {
  APP = 'app.py',
  REQUIREMENTS = 'requirements.txt',
}

export const CONFIRM_SOURCE_FOLDER_VALUES: ConfirmDialogValueTypes = {
  heading: SettingsI18nKeys.ConfirmChangingSourceFolder,
  description: SettingsI18nKeys.ChangingSourceFolderDescription,
};

export const CONFIRM_ICON_FILE_VALUES: ConfirmDialogValueTypes = {
  heading: SettingsI18nKeys.ConfirmChangingIconFile,
  description: SettingsI18nKeys.ChangingIconFileDescription,
};

export const CONFIRM_DOCUMENT_VALUES: ConfirmDialogValueTypes = {
  heading: SettingsI18nKeys.ConfirmChangingDocumentUrls,
  description: SettingsI18nKeys.ChangingDocumentUrlsDescription,
};

export const DRAFT_APPLICATION_ID = `${ApiKeys.Applications}/draft`;

export enum AppsEditorQuery {
  Id = 'id',
  Step = 'step',
  Schema = 'schema',
  PublicationUrl = 'publicationUrl',
  ReturnUrl = 'returnUrl',
  IsCreating = 'isCreating',
}

export const PUBLIC_APP_TOOLTIP = translate(
  CommonI18nKeys.AppIsPublicCannotBeEdited,
  {
    ns: Translation.Common,
  },
);

export enum ApplicationPropertiesLocalFields {
  isExternalApp = 'isExternalApp',
  isSchemaDrivenApp = 'isSchemaDrivenApp',
}
