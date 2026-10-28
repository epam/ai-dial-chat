import { SchedulerServiceConsentStatus } from '@epam/ai-dial-chat-api-client';
import type {
  GetOfflineCredentialsResponseDto,
  OfflineCredentialsConnectDto,
} from '@epam/ai-dial-chat-api-client';
import type {
  OfflineCredentialsConnectSettings,
  OfflineCredentialsStatusResult,
} from './useOfflineCredentialsGate/useOfflineCredentialsGate';

/**
 * Normalizes the response's `connect` object into login-usable OAuth client
 * settings — present only when its `clientId` and `authorizationEndpoint`
 * are both set; `scopes` defaults to an empty list.
 */
export const normalizeOfflineCredentialsConnectSettings = (
  connect?: OfflineCredentialsConnectDto,
): OfflineCredentialsConnectSettings | undefined =>
  connect?.clientId != null && connect?.authorizationEndpoint != null
    ? {
        clientId: connect.clientId,
        authorizationEndpoint: connect.authorizationEndpoint,
        scopes: connect.scopes ?? [],
      }
    : undefined;

/**
 * Normalizes a `getOfflineCredentials` response into the shared
 * `OfflineCredentialsStatusResult`: the `available`/`connected` flags
 * null-coalesced to `false`, OAuth client settings present only when a
 * login is possible — the service is available and disconnected, and the
 * response's `connect` object is complete enough to drive one — and the
 * scheduler service consent passed through, defaulting to `unknown` when
 * the response omitted it (older BFF) or carried a value outside the
 * enum.
 */
export const mapOfflineCredentialsResponse = (
  response: GetOfflineCredentialsResponseDto,
): OfflineCredentialsStatusResult => {
  const available = response.available ?? false;
  const connected = response.connected ?? false;

  return {
    available,
    connected,
    connect:
      available && !connected
        ? normalizeOfflineCredentialsConnectSettings(response.connect)
        : undefined,
    schedulerServiceConsent:
      response.schedulerServiceConsent != null &&
      Object.values(SchedulerServiceConsentStatus).includes(
        response.schedulerServiceConsent,
      )
        ? response.schedulerServiceConsent
        : SchedulerServiceConsentStatus.Unknown,
  };
};
