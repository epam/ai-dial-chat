export const DEFAULT_QUICK_APPS_MODEL = 'gpt-4o';

export const DEFAULT_QUICK_APPS_HOST =
  'http://quickapps.dial-development.svc.cluster.local';

export const DEFAULT_QUICK_APPS_SCHEMA_ID =
  'https://mydial.epam.com/custom_application_schemas/quickapps';

export const DEFAULT_QUICK_APPS_SCHEMA_2_ID =
  'https://mydial.epam.com/custom_application_schemas/quickapps2';

export enum ToolsetTypes {
  DialMcp = 'dial-mcp',
  DialDeployment = 'dial-deployment',
  CodeInterpreter = 'predefined',
}

export enum DialDeploymentToolsetToolTypes {
  DialDeploymentSimple = 'dial-deployment-simple',
}

export const AGENTS_AND_TOOLSETS_MODAL_QUERY_PARAM = 'agentsAndToolsetsModal';
export const AGENTS_AND_TOOLSETS_SCOPE_TAB_QUERY_PARAM =
  'agentsAndToolsetsScopeTab';
export const AGENTS_AND_TOOLSETS_SEARCH_TERM_QUERY_PARAM =
  'agentsAndToolsetsSearchTerm';
export const AGENTS_AND_TOOLSETS_SLIDER_ACTIVE_SLIDE_QUERY_PARAM =
  'agentsAndToolsetsSliderActiveSlide';
export const AGENTS_AND_TOOLSETS_SLIDER_PREV_ACTIVE_SLIDE_QUERY_PARAM =
  'agentsAndToolsetsSliderPrevActiveSlide';
