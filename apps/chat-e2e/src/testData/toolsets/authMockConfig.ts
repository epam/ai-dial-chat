import {
  ToolsetAuthPayloadBase,
  ToolsetCredentialsLevel,
} from '@/chat/types/toolsets';
import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

export type SignInRequest =
  | ToolsetApiKeySignInRequest
  | ToolsetOAuthSignInRequest;

export interface OAuthMockConfig {
  client_id: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported: string[];
  code_challenge_method: string;
  client_secret: string;
}

export interface AuthState<T extends SignInRequest> {
  isSignedIn: boolean;
  enableMocking: boolean;
  signInRequest: T | null;
  signOutRequest: ToolsetAuthPayloadBase | null;
}

export interface StatusCodeConfig {
  updateToolsetCode?: number;
  backendSignInCode?: number;
}

export interface OAuthMockOptions extends StatusCodeConfig {
  mockOAuthConfig?: Partial<OAuthMockConfig>;
  authorizationCode?: string;
}

export type ApiKeyMockOptions = StatusCodeConfig;

interface CommonSignInRequestParams {
  credentialsLevel: ToolsetCredentialsLevel;
  url: string;
  authenticationType: ToolsetAuthTypes;
}

export interface ToolsetOAuthSignInRequest extends CommonSignInRequestParams {
  code: string;
  state?: string;
}

export interface ToolsetApiKeySignInRequest extends CommonSignInRequestParams {
  apiKey: string;
}

export const DEFAULT_OAUTH_CONFIG: OAuthMockConfig = {
  client_id: 'dial-test-client-12345',
  authorization_endpoint: '',
  token_endpoint: '',
  scopes_supported: ['mcp.read', 'mcp.execute', 'mcp.tools'],
  code_challenge_method: 'S256',
  client_secret: '',
};

export const DEFAULT_AUTHORIZATION_CODE = 'MOCK_AUTH_CODE_12345';
