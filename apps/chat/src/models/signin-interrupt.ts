import {
  ExternalServiceCredentialsLevel,
  type ExternalServiceAuthType,
  type ToolsetCredentialsLevel,
} from '@epam/ai-dial-chat-hooks';

export interface OAuthSettings {
  clientId?: string;
  authorizationEndpoint?: string;
  scopes?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface ResolvedRowInfo {
  displayName: string;
  displayVersion?: string;
  authenticationType?: ExternalServiceAuthType;
  credentialsLevel: ToolsetCredentialsLevel | ExternalServiceCredentialsLevel;
  oauthSettings?: OAuthSettings;
}
