export const DEFAULT_QUICK_APPS_MODEL = 'gpt-4o';

export const DEFAULT_QUICK_APPS_HOST =
  'http://quickapps.dial-development.svc.cluster.local';

export const DEFAULT_QUICK_APPS_SCHEMA_ID =
  'https://mydial.epam.com/custom_application_schemas/quickapps';

export const DEFAULT_QUICK_APPS_SCHEMA_2_ID =
  'https://mydial.epam.com/custom_application_schemas/quickapps2';

export enum ToolsetTypes {
  DialMcp = 'dial-mcp',
  DialApp = 'dial-app',
  DialDeployment = 'dial-deployment',
  CodeInterpreter = 'predefined',
}

export enum DialDeploymentToolsetToolTypes {
  DialDeploymentSimple = 'dial-deployment-simple',
}

export enum AgentsAndToolsetsModalQueryParams {
  Modal = 'agentsAndToolsetsModal',
  ScopeTab = 'agentsAndToolsetsScopeTab',
  SearchTerm = 'agentsAndToolsetsSearchTerm',
  SliderActiveSlide = 'agentsAndToolsetsSliderActiveSlide',
  SliderPrevActiveSlide = 'agentsAndToolsetsSliderPrevActiveSlide',
}
