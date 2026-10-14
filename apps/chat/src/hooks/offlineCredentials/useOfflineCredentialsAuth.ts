import { useOfflineCredentialsAuth as useLibOfflineCredentialsAuth } from '@epam/ai-dial-chat-hooks';
import type { OfflineCredentialsAuthGate } from '@epam/ai-dial-chat-hooks';
import { offlineCredentialsApi } from '../../server-api/api-client';
import { ROUTES } from '../../types/routes';

/**
 * App wiring for the shared offline-credentials auth orchestration: pre-wires
 * the lib hook with the app's configured client and OAuth callback route.
 * Outcome-based — map `loginOutcome` and `logOut`'s resolved outcome onto
 * announcement text in the caller (`utils/offline-credentials-announcements`).
 */
export const useOfflineCredentialsAuth = (gate: OfflineCredentialsAuthGate) =>
  useLibOfflineCredentialsAuth({
    ...gate,
    offlineCredentialsClient: offlineCredentialsApi,
    callbackPath: ROUTES.ToolsetSignIn,
  });
