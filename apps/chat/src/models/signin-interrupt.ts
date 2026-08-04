import type { ToolsetCredentialsLevel } from '../constants/toolsets';
import type { ExternalServiceCredentialsLevel } from '../server-api/external-services';
import type { RowAuthType } from '../types/signin-interrupt';

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
  authenticationType?: RowAuthType;
  credentialsLevel: ToolsetCredentialsLevel | ExternalServiceCredentialsLevel;
  oauthSettings?: OAuthSettings;
}
