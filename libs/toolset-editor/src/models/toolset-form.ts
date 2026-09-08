import type {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
import type { DeploymentCreationFormLocaleEntry } from '@epam/ai-dial-builder-form';
import type { ToolsetTransportType } from '../constants/toolsets';

export interface ToolsetAuthFormData {
  /** Selected authentication mechanism for the toolset. */
  authenticationType: ToolsetAuthTypes;
  /** Whether credentials are sent per login, embedded in the config, or not at all. */
  withLogin: WithLogin;
  /** Whether the user is currently authenticated against the toolset. */
  isLoggedIn: boolean;
  /** API_KEY: header/parameter name the API key is sent under. */
  keyHeader?: string;
  /** API_KEY: the key value, submitted on login. */
  apiKey?: string;
  /** OAUTH: registered client id. */
  clientId?: string;
  /** OAUTH: client secret, never returned by the backend on read. */
  clientSecret?: string;
  /** OAUTH: authorization endpoint URL. */
  authorizationEndpoint?: string;
  /** OAUTH: token endpoint URL. */
  tokenEndpoint?: string;
  /** OAUTH: scopes requested during login. */
  scopes?: string[];
  /** OAUTH: PKCE code challenge value, when the backend supplied one. */
  codeChallenge?: string;
  /** OAUTH: PKCE code challenge method, when the backend supplied one. */
  codeChallengeMethod?: string;
}

export interface DeploymentGeneralFormData {
  /** Display name of the entity in its primary locale. */
  name: string;
  /** Display version of the entity. */
  version: string;
  /** URL of the entity's avatar image, or empty for the placeholder. */
  iconUrl: string;
  /** Description of the entity in its primary locale. */
  description: string;
  /** Topic tags describing the entity. */
  topics: string[];
  /** Additional (non-primary) locale entries for name/description, edited via the "Add locale" popup. */
  otherLocales: DeploymentCreationFormLocaleEntry[];
}

export interface ToolsetFormData extends DeploymentGeneralFormData {
  /** MCP server endpoint URL. */
  endpoint: string;
  /** MCP transport protocol used to reach the endpoint. */
  protocol: ToolsetTransportType;
  /** Tool names the toolset is restricted to, or empty for all tools. */
  allowedTools: string[];
  /** Backend-assigned immutable reference, present only in edit mode. */
  reference?: string;
  /** Authentication form state for the toolset. */
  auth: ToolsetAuthFormData;
}

export interface ToolsetFormErrors {
  /** Validation message for the Metadata name field. */
  name?: string;
  /** Validation message for the Metadata version field. */
  version?: string;
  /** Validation message for the Setup endpoint field. */
  endpoint?: string;
  /** Validation message for the API-key header field. */
  keyHeader?: string;
  /** Validation message for the API-key value field. */
  apiKey?: string;
  /** Validation message for the OAuth client id field. */
  clientId?: string;
  /** Validation message for the OAuth client secret field. */
  clientSecret?: string;
  /** Validation message for the OAuth authorization endpoint field. */
  authorizationEndpoint?: string;
  /** Validation message for the OAuth token endpoint field. */
  tokenEndpoint?: string;
}

/**
 * Credentials submission for one toolset login. Structurally identical to
 * DIAL Core's login body; the host adapter forwards it to its own API client.
 */
export interface ToolsetLoginRequest {
  /** Already-encoded toolset id/url the credentials apply to. */
  url: string;
  /** Credentials level the submitted credentials apply to. */
  credentialsLevel: ToolsetCredentialsLevel;
  /** Authentication mechanism the toolset requires. */
  authenticationType: ToolsetAuthTypes;
  /** API key value, required for `ToolsetAuthTypes.ApiKey` logins. */
  apiKey?: string;
}

/**
 * Credential-clearing request for one toolset logout. Structurally identical
 * to DIAL Core's logout body; the host adapter forwards it to its own API
 * client.
 */
export interface ToolsetLogoutRequest {
  /** Already-encoded toolset id/url the credentials apply to. */
  url: string;
  /** Credentials level being logged out. */
  credentialsLevel: ToolsetCredentialsLevel;
  /** Authentication mechanism the toolset uses. */
  authenticationType: ToolsetAuthTypes;
}

/** Backend calls the auth block needs, injected by the host. */
export interface ToolsetAuthActions {
  /** Submits credentials for one toolset at one credentials level. */
  login: (toolsetId: string, body: ToolsetLoginRequest) => Promise<unknown>;
  /** Clears stored credentials for one toolset at one credentials level. */
  logout: (toolsetId: string, body: ToolsetLogoutRequest) => Promise<unknown>;
  /** Re-reads a toolset's stored auth settings, mapped into auth form state. */
  fetchAuthSettings: (toolsetId: string) => Promise<ToolsetAuthFormData>;
}
