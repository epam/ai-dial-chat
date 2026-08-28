import type { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import type { DeploymentCreationFormLocaleEntry } from '@epam/ai-dial-deployment-creation-form';
import type { ToolsetTransportType } from '../constants/toolsets';

export interface ToolsetAuthFormData {
  authenticationType: ToolsetAuthTypes;
  withLogin: WithLogin;
  isLoggedIn: boolean;
  // API_KEY
  keyHeader?: string;
  apiKey?: string;
  // OAUTH
  clientId?: string;
  clientSecret?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  scopes?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface DeploymentGeneralFormData {
  name: string;
  version: string;
  iconUrl: string;
  description: string;
  topics: string[];
  /** Additional (non-primary) locale entries for name/description, edited via the "Add locale" popup. */
  otherLocales: DeploymentCreationFormLocaleEntry[];
}

export interface ToolsetFormData extends DeploymentGeneralFormData {
  endpoint: string;
  protocol: ToolsetTransportType;
  allowedTools: string[];
  reference?: string;
  auth: ToolsetAuthFormData;
}

export interface ToolsetFormErrors {
  name?: string;
  version?: string;
  endpoint?: string;
  keyHeader?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
}
