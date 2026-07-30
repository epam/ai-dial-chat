import type { components, operations } from '@epam/ai-dial-typescript-sdk';
import {
  ExternalServiceAuthType,
  type ExternalServiceSigninBodyDto,
  type ExternalServiceLogoutBodyDto,
  type GetExternalServiceResponseDto,
} from './dto/external-service.dto';

/*
 * DIAL Core's resource `url` convention for an application external service
 * is `{appId}/external_services/{serviceId}` (underscore) — distinct from the
 * REST path segment `external-services` (hyphen) this module's own routes
 * use. Reconstructing it from the already-validated `appId`/`serviceId` path
 * params keeps this Core-specific convention inside the BFF mapper instead of
 * the frontend. Confirmed required: Core rejects a bare application id (no
 * `/external_services/{serviceId}` suffix) for sign-in/sign-out with
 * "Invalid external service scope id".
 */
const EXTERNAL_SERVICE_URL_SEGMENT = 'external_services';

export const toDialExternalServiceUrl = (
  appId: string,
  serviceId: string,
): string => `${appId}/${EXTERNAL_SERVICE_URL_SEGMENT}/${serviceId}`;

type DialExternalServiceData = components['schemas']['ExternalServiceData'];
type DialExternalServiceSigninBody =
  operations['externalServiceSignIn']['requestBody']['content']['application/json'];
type DialExternalServiceSignoutBody =
  operations['externalServiceSignOut']['requestBody']['content']['application/json'];

export const toDialExternalServiceSigninBody = (
  appId: string,
  serviceId: string,
  body: ExternalServiceSigninBodyDto,
): DialExternalServiceSigninBody => ({
  url: toDialExternalServiceUrl(appId, serviceId),
  credentialsLevel: body.credentialsLevel,
  authenticationType: body.authenticationType,
  apiKey: body.apiKey,
  code: body.code,
  redirectUri: body.redirectUri,
});

export const toDialExternalServiceSignoutBody = (
  appId: string,
  serviceId: string,
  body: ExternalServiceLogoutBodyDto,
): DialExternalServiceSignoutBody => ({
  url: toDialExternalServiceUrl(appId, serviceId),
  credentialsLevel: body.credentialsLevel,
  authenticationType: body.authenticationType,
});

export const mapDialExternalServiceToDto = (
  data: DialExternalServiceData,
): GetExternalServiceResponseDto => ({
  displayName: data.display_name ?? '',
  description: data.description,
  authenticationType:
    (data.auth_settings?.authentication_type as
      | ExternalServiceAuthType
      | undefined) ?? ExternalServiceAuthType.None,
  userLevelAuthStatus: data.auth_settings?.user_level_auth_status,
  globalAuthStatus: data.auth_settings?.global_auth_status,
  clientId: data.auth_settings?.client_id,
  authorizationEndpoint: data.auth_settings?.authorization_endpoint,
  scopesSupported: data.auth_settings?.scopes_supported,
  codeChallenge: data.auth_settings?.code_challenge,
  codeChallengeMethod: data.auth_settings?.code_challenge_method,
});
