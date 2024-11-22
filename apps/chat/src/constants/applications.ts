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
