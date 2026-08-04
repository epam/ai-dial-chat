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

export const ORCHESTRATOR_ATTACHMENT_STRATEGY_VALUE: {
  type: 'lazy_on_demand';
} | null = { type: 'lazy_on_demand' };

export const TIMESTAMP_FEATURE_VALUE: {
  injection_strategy: 'tool_call';
} | null = { injection_strategy: 'tool_call' };

export const REPRESENTATION_TOOLING_FEATURE_VALUE: {
  add_attachment: true;
} | null = { add_attachment: true };

export const WEB_FETCH_FEATURE_VALUE: { enabled: boolean } | null = {
  enabled: true,
};
