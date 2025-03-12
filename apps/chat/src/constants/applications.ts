import { ConfirmDialogValueTypes } from '../types/files';

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
    'Changing of source folder will stop sharing and other users will no longer see this application.',
};

export const CONFIRM_ICON_FILE_VALUES: ConfirmDialogValueTypes = {
  heading: 'Confirm changing icon file',
  description:
    'Changing of icon file will stop sharing the file and other users will see default icon this application.',
};

export const CONFIRM_DOCUMENT_VALUES: ConfirmDialogValueTypes = {
  heading: 'Confirm changing source folder',
  description:
    'Changing of document relative url will stop sharing and other users will no longer see this application.',
};
