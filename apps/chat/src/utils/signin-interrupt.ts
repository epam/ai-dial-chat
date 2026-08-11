import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import { ToolsetCredentialsLevel } from '../constants/toolsets';
import type { ResolvedRowInfo } from '../models/signin-interrupt';
import type { GetExternalServiceResponseDto } from '../server-api/external-services';
import { ExternalServiceCredentialsLevel } from '../server-api/external-services';
import type { RowAuthType } from '../types/signin-interrupt';
import { getExternalServiceFallbackName } from './external-services';
import { PRIMARY_LOCALE, resolveLocalizedText } from './locale';
import { getToolsetFallbackName, isPublicToolsetId } from './toolsets';

export const resolveToolsetInfo = (
  toolsetId: string,
  toolset: DialToolsetDto | undefined,
  activeLocale = PRIMARY_LOCALE,
): ResolvedRowInfo => ({
  displayName:
    resolveLocalizedText(toolset?.displayName, activeLocale) ||
    getToolsetFallbackName(toolsetId),
  displayVersion: toolset?.displayVersion,
  authenticationType: toolset?.authSettings?.authenticationType as
    | RowAuthType
    | undefined,
  credentialsLevel: isPublicToolsetId(toolsetId)
    ? ToolsetCredentialsLevel.User
    : ToolsetCredentialsLevel.Global,
  oauthSettings: {
    clientId: toolset?.authSettings?.clientId,
    authorizationEndpoint: toolset?.authSettings?.authorizationEndpoint,
    scopes: toolset?.authSettings?.scopesSupported,
    codeChallenge: toolset?.authSettings?.codeChallenge,
    codeChallengeMethod: toolset?.authSettings?.codeChallengeMethod,
  },
});

export const resolveExternalServiceInfo = (
  serviceName: string,
  service: GetExternalServiceResponseDto | undefined,
): ResolvedRowInfo => ({
  displayName:
    service?.displayName || getExternalServiceFallbackName(serviceName),
  authenticationType: service?.authenticationType as RowAuthType | undefined,
  /*
   * Best-effort default per design.md Open Question 2 — Core does not yet
   * document how a *pushed* event determines credentials level; USER
   * unless the service is only signed out at GLOBAL level.
   */
  credentialsLevel:
    service?.globalAuthStatus != null &&
    service.globalAuthStatus !== 'SIGNED_IN' &&
    service.userLevelAuthStatus == null
      ? ExternalServiceCredentialsLevel.Global
      : ExternalServiceCredentialsLevel.User,
  oauthSettings: {
    clientId: service?.clientId,
    authorizationEndpoint: service?.authorizationEndpoint,
    scopes: service?.scopesSupported,
    codeChallenge: service?.codeChallenge,
    codeChallengeMethod: service?.codeChallengeMethod,
  },
});
