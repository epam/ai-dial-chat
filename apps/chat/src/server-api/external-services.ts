import { get, post, ApiEndpoints } from './base';

/*
 * `apps/chat-api/src/external-services` has no generated-client coverage yet
 * — `npm run openapi` is blocked by a pre-existing, unrelated bug in
 * `app-config.service.ts` (see openspec/specs/external-service-authentication/
 * spec.md). These types and calls are hand-written to match
 * `GetExternalServiceResponseDto`/`ExternalServiceSigninBodyDto`/
 * `ExternalServiceLogoutBodyDto` in
 * `apps/chat-api/src/external-services/dto/external-service.dto.ts` exactly;
 * replace this file's request plumbing with generated `@epam/ai-dial-chat-api-client`
 * wrappers once that bug is fixed and the client is regenerated.
 */

export enum ExternalServiceAuthType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
}

export enum ExternalServiceCredentialsLevel {
  Global = 'GLOBAL',
  Application = 'APPLICATION',
  User = 'USER',
}

export interface GetExternalServiceResponseDto {
  displayName: string;
  description?: string;
  authenticationType: ExternalServiceAuthType;
  userLevelAuthStatus?: string;
  globalAuthStatus?: string;
  clientId?: string;
  authorizationEndpoint?: string;
  scopesSupported?: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface ExternalServiceSigninBodyDto {
  credentialsLevel: ExternalServiceCredentialsLevel;
  authenticationType: ExternalServiceAuthType;
  apiKey?: string;
  code?: string;
  redirectUri?: string;
}

export interface ExternalServiceLogoutBodyDto {
  credentialsLevel: ExternalServiceCredentialsLevel;
  authenticationType: ExternalServiceAuthType;
}

export interface ExternalServiceAuthResultDto {
  success: boolean;
}

const encodeSegment = (segment: string): string => encodeURIComponent(segment);

export const getExternalService = (
  appId: string,
  serviceId: string,
): Promise<GetExternalServiceResponseDto> =>
  get<GetExternalServiceResponseDto>(
    `${ApiEndpoints.EXTERNAL_SERVICES}/${encodeSegment(appId)}/${encodeSegment(serviceId)}`,
  );

export const signInExternalService = (
  appId: string,
  serviceId: string,
  body: ExternalServiceSigninBodyDto,
): Promise<ExternalServiceAuthResultDto> =>
  post<ExternalServiceAuthResultDto>(
    `${ApiEndpoints.EXTERNAL_SERVICES}/${encodeSegment(appId)}/${encodeSegment(serviceId)}/signin`,
    body,
  );

export const signOutExternalService = (
  appId: string,
  serviceId: string,
  body: ExternalServiceLogoutBodyDto,
): Promise<ExternalServiceAuthResultDto> =>
  post<ExternalServiceAuthResultDto>(
    `${ApiEndpoints.EXTERNAL_SERVICES}/${encodeSegment(appId)}/${encodeSegment(serviceId)}/signout`,
    body,
  );
