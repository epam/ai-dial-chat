import {
  useToolsetLogin as useSharedToolsetLogin,
  type UseToolsetLoginResult,
} from '@epam/ai-dial-chat-hooks/oauth';
import {
  getToolset,
  loginToolset,
  logoutToolset,
} from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';

/**
 * Thin app adapter over `@epam/ai-dial-chat-hooks`'s `useToolsetLogin`,
 * injecting this app's `server-api/toolsets` wrappers and its own OAuth
 * callback route.
 */
export const useToolsetLogin = (): UseToolsetLoginResult =>
  useSharedToolsetLogin({
    callbackPath: ROUTES.ToolsetSignIn,
    loginToolset,
    logoutToolset,
    getToolset,
  });
