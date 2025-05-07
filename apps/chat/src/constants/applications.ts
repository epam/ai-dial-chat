import { ApiKeys, ConfirmDialogValueTypes } from '@/src/types/common';

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
  heading: 'Confirm changing source folder',
  description:
    'Changing the source folder will immediately stop sharing, and other users will no longer see this application.',
};

export const CONFIRM_ICON_FILE_VALUES: ConfirmDialogValueTypes = {
  heading: 'Confirm changing icon file',
  description:
    'Are you sure you want to change the icon? Other users will see the default one immediately after confirmation.',
};

export const CONFIRM_DOCUMENT_VALUES: ConfirmDialogValueTypes = {
  heading: 'Confirm changing document relative URLs',
  description:
    'Changing document relative URLs will immediately stop sharing, and other users will no longer see this application.',
};

export const DRAFT_APPLICATION_ID = `${ApiKeys.Applications}/draft`;
