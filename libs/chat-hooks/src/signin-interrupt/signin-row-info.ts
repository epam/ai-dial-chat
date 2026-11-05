import type {
  DialToolsetDto,
  GetExternalServiceResponseDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ExternalServiceAuthStatus,
  type ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
} from '../external-services/useExternalServiceLogin';
import { toToolsetOAuthSettings } from '../oauth/authorize-url';
import {
  getToolsetFallbackName,
  resolveToolsetCredentialsLevel,
} from '../oauth/toolset-id';
import {
  type PendingSigninEvent,
  PendingSigninEventKind,
} from '../shared/client-channel';
import {
  buildExternalServiceScopeId,
  getExternalServiceFallbackName,
} from '../shared/external-services';
import { resolveLocalizedText } from '../shared/locale';
import type { SigninRowInfo } from './models';

/** Returns the key of a pending event's underlying resource: the toolset id, or the external-service scope id. */
export const getSigninEventResourceKey = (event: PendingSigninEvent): string =>
  event.kind === PendingSigninEventKind.Toolset
    ? event.toolsetId
    : buildExternalServiceScopeId(event.appId, event.serviceName);

/** Returns the row metadata for a toolset, falling back to a name derived from its id while `toolset` is unknown. */
export const resolveToolsetSigninRowInfo = (
  toolsetId: string,
  toolset: DialToolsetDto | undefined,
  activeLocale: string,
  primaryLocale: string,
): SigninRowInfo => ({
  displayName:
    resolveLocalizedText(toolset?.displayName, activeLocale, primaryLocale) ||
    getToolsetFallbackName(toolsetId),
  displayVersion: toolset?.displayVersion,
  authenticationType: toolset?.authSettings?.authenticationType as
    ExternalServiceAuthType | undefined,
  credentialsLevel: resolveToolsetCredentialsLevel(toolsetId),
  oauthSettings: toToolsetOAuthSettings(toolset?.authSettings),
});

/** Returns the row metadata for an application's external service, falling back to its decoded name while `service` is unknown. */
export const resolveExternalServiceSigninRowInfo = (
  serviceName: string,
  service: GetExternalServiceResponseDto | undefined,
): SigninRowInfo => ({
  displayName:
    service?.displayName || getExternalServiceFallbackName(serviceName),
  authenticationType: service?.authenticationType as
    ExternalServiceAuthType | undefined,
  /*
   * Best-effort default per `openspec/changes/archive/2026-07-30-interactive-external-service-login-chat/design.md` Open Question 2 — Core does not yet
   * document how a *pushed* event determines credentials level; USER
   * unless the service is only signed out at GLOBAL level.
   */
  credentialsLevel:
    service?.globalAuthStatus != null &&
    service.globalAuthStatus !== ExternalServiceAuthStatus.SignedIn &&
    service.userLevelAuthStatus == null
      ? ExternalServiceCredentialsLevel.Global
      : ExternalServiceCredentialsLevel.User,
  oauthSettings: toToolsetOAuthSettings(service),
});
