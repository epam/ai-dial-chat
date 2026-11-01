import {
  CredentialStatus,
  ToolsetAuthenticationType,
  type ApplicationCredential,
  type ApplicationCredentialLoginParams,
} from '@epam/ai-dial-catalog';
import type { ApplicationExternalServiceDto } from '@epam/ai-dial-chat-api-client';
import {
  ExternalServiceAuthStatus,
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  type ExternalServiceLoginParams,
} from '../external-services/useExternalServiceLogin';

/** Host-resolved inputs of `mapApplicationCredentials`. */
export interface MapApplicationCredentialsOptions {
  /** Whether the user's offline credentials are connected, as `useApplicationCredentials` reports. */
  isOfflineConnected: boolean;
  /** Localized explanation shown on `DIAL_NATIVE` services. */
  dialNativeHint?: string;
}

/** Returns the credentials-form view of each application external service. */
export const mapApplicationCredentials = (
  services: readonly ApplicationExternalServiceDto[],
  { isOfflineConnected, dialNativeHint }: MapApplicationCredentialsOptions,
): ApplicationCredential[] =>
  services.map((service) => {
    // A DIAL-native service has no personal login: it works once offline credentials and the app grant exist.
    const isNative =
      service.authenticationType === ExternalServiceAuthType.DialNative;
    const isSignedIn = isNative
      ? isOfflineConnected &&
        service.appLevelAuthStatus === ExternalServiceAuthStatus.SignedIn
      : service.userLevelAuthStatus === ExternalServiceAuthStatus.SignedIn;

    return {
      id: service.id,
      name: service.displayName || service.id,
      description: service.description,
      authenticationType:
        service.authenticationType === ExternalServiceAuthType.ApiKey
          ? ToolsetAuthenticationType.ApiKey
          : ToolsetAuthenticationType.OAuth,
      status: isSignedIn
        ? CredentialStatus.SignedIn
        : CredentialStatus.SignedOut,
      hasSharedCredentials:
        !isNative &&
        !isSignedIn &&
        (service.globalAuthStatus === ExternalServiceAuthStatus.SignedIn ||
          service.appLevelAuthStatus === ExternalServiceAuthStatus.SignedIn),
      canLogout: !isNative,
      canConsentToOfflineUsage: !isNative,
      hint: isNative ? dialNativeHint : undefined,
    };
  });

/** Returns the user-level `login` request for an application external service and the submitted form values. */
export const buildApplicationCredentialLoginParams = (
  appId: string,
  service: ApplicationExternalServiceDto,
  params: ApplicationCredentialLoginParams,
): ExternalServiceLoginParams => ({
  appId,
  serviceId: service.id,
  ...params,
  credentialsLevel: ExternalServiceCredentialsLevel.User,
  authenticationType: service.authenticationType as ExternalServiceAuthType,
  oauthSettings: {
    clientId: service.clientId,
    authorizationEndpoint: service.authorizationEndpoint,
    scopes: service.scopesSupported,
    codeChallenge: service.codeChallenge,
    codeChallengeMethod: service.codeChallengeMethod,
  },
  // A failed personal credential is stale; re-login must replace it rather than reuse it.
  forceStale: service.userLevelAuthStatus === ExternalServiceAuthStatus.Failed,
});
