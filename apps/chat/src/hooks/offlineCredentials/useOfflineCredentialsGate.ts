import { useOfflineCredentialsGate as useLibOfflineCredentialsGate } from '@epam/ai-dial-chat-hooks';
import { offlineCredentialsApi } from '../../server-api/api-client';

/**
 * App wiring for the shared offline-credentials gate: pre-wires the lib hook
 * with the app's configured generated client. Fires the status check on
 * mount, aborts it in flight on unmount; re-run any time via `refetch`.
 */
export const useOfflineCredentialsGate = () =>
  useLibOfflineCredentialsGate({
    offlineCredentialsClient: offlineCredentialsApi,
  });
