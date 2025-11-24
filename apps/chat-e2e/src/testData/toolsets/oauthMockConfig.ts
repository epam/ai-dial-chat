import { ToolsetCredentialsLevel } from '@/chat/types/toolsets';
import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

export interface OAuthMockConfig {
  client_id: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported: string[];
  code_challenge_method: string;
}

export interface OAuthMockOptions {
  mockOAuthConfig?: Partial<OAuthMockConfig>;
  authorizationCode?: string;
}

export const DEFAULT_OAUTH_CONFIG: OAuthMockConfig = {
  client_id: 'dial-test-client-12345',
  authorization_endpoint: '',
  token_endpoint: '',
  scopes_supported: ['mcp.read', 'mcp.execute', 'mcp.tools'],
  code_challenge_method: 'S256',
};

export interface ToolsetSignInRequest {
  url: string;
  authenticationType: ToolsetAuthTypes;
  credentialsLevel: ToolsetCredentialsLevel;
  code: string;
  state?: string;
}

export const DEFAULT_AUTHORIZATION_CODE = 'MOCK_AUTH_CODE_12345';
