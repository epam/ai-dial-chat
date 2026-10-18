import type { GetOfflineCredentialsResponseDto } from '@epam/ai-dial-chat-api-client';
import { getApiErrorStatus } from '../api-error/api-error';
import {
  mapOfflineCredentialsResponse,
  normalizeOfflineCredentialsConnectSettings,
} from '../offline-credentials/map-offline-credentials-response';
import type { OfflineCredentialsConnectSettings } from '../offline-credentials/useOfflineCredentialsGate/useOfflineCredentialsGate';

/** Result of the 403-triggered offline-credentials check on a failed scheduled-task submit. */
export interface ScheduledTaskAuthSessionCheckResult {
  /** Whether the failure is attributed to the logged-out external Scheduler auth service. */
  isAuthSessionError: boolean;
  /**
   * OAuth client settings from the same single check, present only when they
   * are complete enough to drive a login — returned regardless of the
   * connection state, so the caller decides from one check; the auto-login
   * consumes them without a second client-settings request.
   */
  connect?: OfflineCredentialsConnectSettings;
}

/**
 * Checks whether a failed scheduled-task submit should be attributed to the
 * logged-out external Scheduler auth service, and returns the OAuth client
 * settings from the same check when they can drive a login: exactly when the
 * failure is a `403` and one fresh offline-credentials status check (the
 * passed-in `getOfflineCredentials` operation) reports an available OAuth
 * client with no stored grant. Every other outcome — a non-`403` failure, a
 * still-connected user, an incomplete `connect` object, or a failed check —
 * returns `isAuthSessionError: false` so the caller keeps its generic error
 * handling. Issues at most one status request, and only on the `403` path.
 */
export const checkScheduledTaskAuthSessionError = async (
  error: unknown,
  getOfflineCredentials: () => Promise<GetOfflineCredentialsResponseDto>,
): Promise<ScheduledTaskAuthSessionCheckResult> => {
  if (getApiErrorStatus(error) !== 403) {
    return { isAuthSessionError: false };
  }
  try {
    const response = await getOfflineCredentials();
    const { available, connected } = mapOfflineCredentialsResponse(response);
    return {
      isAuthSessionError: available && !connected,
      connect: normalizeOfflineCredentialsConnectSettings(response.connect),
    };
  } catch {
    /* A failed check is not evidence of disconnection — fall back to the
     * generic error so a broken status call cannot misattribute a 403. */
    return { isAuthSessionError: false };
  }
};
