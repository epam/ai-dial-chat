import { useOfflineCredentialsLogin as useLibOfflineCredentialsLogin } from '@epam/ai-dial-chat-hooks';
import { ROUTES } from '../../types/routes';

/**
 * App wiring for the shared offline-credentials login: pre-wires the lib hook
 * with the app's OAuth callback route.
 */
export const useOfflineCredentialsLogin = () =>
  useLibOfflineCredentialsLogin({ callbackPath: ROUTES.ToolsetSignIn });
