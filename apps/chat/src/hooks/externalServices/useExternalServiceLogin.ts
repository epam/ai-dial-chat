import { useExternalServiceLogin as useSharedExternalServiceLogin } from '@epam/ai-dial-chat-hooks';
import {
  getExternalService,
  signInExternalService,
  signOutExternalService,
} from '../../server-api/external-services';
import { getOfflineCredentials } from '../../server-api/offline-credentials';
import { ROUTES } from '../../types/routes';
import { useOfflineCredentialsLogin } from '../offlineCredentials/useOfflineCredentialsLogin';
/** Supplies host transports and callback routing to shared login orchestration. */
export const useExternalServiceLogin = () => {
  const { login: loginOfflineCredentials } = useOfflineCredentialsLogin();
  return useSharedExternalServiceLogin({
    callbackPath: ROUTES.ToolsetSignIn,
    getExternalService,
    signInExternalService,
    signOutExternalService,
    getOfflineCredentials,
    loginOfflineCredentials,
  });
};
