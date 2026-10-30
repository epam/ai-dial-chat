import {
  type ToolsetCredentialsLevel,
  ExternalServiceCredentialsLevel,
} from '@epam/ai-dial-chat-hooks';
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
