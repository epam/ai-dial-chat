export const FEATURES_ENDPOINTS = {
  chat_completion: 'chat_completion',
  rate_endpoint: 'rate_endpoint',
  configuration_endpoint: 'configuration_endpoint',
};

export const FEATURES_ENDPOINTS_NAMES = {
  [FEATURES_ENDPOINTS.chat_completion]: 'Chat Completion',
  [FEATURES_ENDPOINTS.rate_endpoint]: 'Rate',
  [FEATURES_ENDPOINTS.configuration_endpoint]: 'Configuration',
};

export const FEATURES_ENDPOINTS_DEFAULT_VALUES = {
  [FEATURES_ENDPOINTS.chat_completion]:
    '/openai/deployments/app/chat/completions',
  [FEATURES_ENDPOINTS.rate_endpoint]: '/v1/app/rate',
  [FEATURES_ENDPOINTS.configuration_endpoint]: '',
};
export enum CODEAPPS_REQUIRED_FILES {
  APP = 'app.py',
  REQUIREMENTS = 'requirements.txt',
}
