import {
  ExternalServiceCredentialsLevel,
  type ExternalServiceAuthType,
  type ExternalServiceOAuthSettings,
  type ToolsetCredentialsLevel,
} from '@epam/ai-dial-chat-hooks';

export interface ResolvedRowInfo {
  displayName: string;
  displayVersion?: string;
  authenticationType?: ExternalServiceAuthType;
  credentialsLevel: ToolsetCredentialsLevel | ExternalServiceCredentialsLevel;
  oauthSettings?: ExternalServiceOAuthSettings;
}
