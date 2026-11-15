import type { ApplicationCredentialLoginParams } from '@epam/ai-dial-catalog';
import type {
  ApplicationExternalServiceDto,
  ExternalServiceLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback } from 'react';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
  ExternalServiceLoginOutcomeType,
  type ExternalServiceLoginOutcome,
  type ExternalServiceLoginParams,
} from '../../external-services/useExternalServiceLogin';
import { buildApplicationCredentialLoginParams } from '../application-credentials';

/** Localized row-error copy `useApplicationCredentialActions` throws for each failed login or logout. */
export interface ApplicationCredentialActionsLabels {
  /** Login failed, threw, or ended in an unrecognized outcome. Defaults to `'Failed to log in. Please try again.'`. */
  loginFailed: string;
  /** The browser blocked the OAuth popup. Defaults to `'The login popup was blocked by your browser. Please allow popups for this site and try again.'`. */
  popupBlocked: string;
  /** A DIAL administrator must approve the application first. Defaults to `"A DIAL administrator must approve this application's access before you can continue. Contact your administrator, then retry."`. */
  adminConsentRequired: string;
  /** Offline access is not configured for the user. Defaults to `'Offline access is not configured for your account. Contact your administrator.'`. */
  offlineUnavailable: string;
  /** Personal sign-out failed. Defaults to `'Failed to log out. Please try again.'`. */
  logoutFailed: string;
}

/** English defaults of {@link ApplicationCredentialActionsLabels}. */
export const DEFAULT_APPLICATION_CREDENTIAL_ACTIONS_LABELS: ApplicationCredentialActionsLabels =
  {
    loginFailed: 'Failed to log in. Please try again.',
    popupBlocked:
      'The login popup was blocked by your browser. Please allow popups for this site and try again.',
    adminConsentRequired:
      "A DIAL administrator must approve this application's access before you can continue. Contact your administrator, then retry.",
    offlineUnavailable:
      'Offline access is not configured for your account. Contact your administrator.',
    logoutFailed: 'Failed to log out. Please try again.',
  };

/** Parameters accepted by {@link useApplicationCredentialActions}. */
export interface UseApplicationCredentialActionsParams {
  /** The application whose external-service credentials are managed. */
  appId: string;
  /** The application's authenticated services, as `useApplicationCredentials` returns them. */
  services: readonly ApplicationExternalServiceDto[];
  /** The host's external-service login, usually `useExternalServiceLogin().login` pre-wired with its operations. */
  login: (
    params: ExternalServiceLoginParams,
  ) => Promise<ExternalServiceLoginOutcome>;
  /** Already-configured DIAL Core operation that clears one service's credentials at the given level. */
  signOutExternalService: (
    appId: string,
    serviceId: string,
    body: ExternalServiceLogoutBodyDto,
  ) => Promise<unknown>;
  /** Re-reads service statuses, usually `useApplicationCredentials().refresh`. */
  refresh: () => Promise<void>;
  /** Localized error copy; every omitted field falls back to {@link DEFAULT_APPLICATION_CREDENTIAL_ACTIONS_LABELS}. */
  labels?: Partial<ApplicationCredentialActionsLabels>;
}

/** Return value of {@link useApplicationCredentialActions}: the catalog `ApplicationCredentials` callbacks. */
export interface UseApplicationCredentialActionsResult {
  /**
   * `onLogin` for the catalog forms. Resolves `true` after a successful login
   * and status refresh, `false` when the service is unknown or the user
   * cancelled, and throws an `Error` carrying the localized message otherwise.
   */
  onLogin: (
    serviceId: string,
    params: ApplicationCredentialLoginParams,
  ) => Promise<boolean>;
  /**
   * `onLogout` for the catalog forms. Signs out only the user's own
   * credentials, then refreshes; does nothing for an unknown or DIAL-native
   * service, and throws an `Error` carrying the localized message when sign-out fails.
   */
  onLogout: (serviceId: string) => Promise<void>;
}

/**
 * Owns the application-credentials login/logout flow behind the catalog's
 * `ApplicationCredentials` forms: builds the user-level login request,
 * classifies its outcome (success → refresh, cancel → no-op, anything else →
 * a localized row error), and signs out only USER credentials before refreshing.
 * Every host operation and string arrives as a parameter.
 */
export const useApplicationCredentialActions = ({
  appId,
  services,
  login,
  signOutExternalService,
  refresh,
  labels,
}: UseApplicationCredentialActionsParams): UseApplicationCredentialActionsResult => {
  const {
    loginFailed,
    popupBlocked,
    adminConsentRequired,
    offlineUnavailable,
    logoutFailed,
  } = { ...DEFAULT_APPLICATION_CREDENTIAL_ACTIONS_LABELS, ...labels };

  const onLogin = useCallback(
    async (serviceId: string, params: ApplicationCredentialLoginParams) => {
      const service = services.find((candidate) => candidate.id === serviceId);
      if (!service) return false;
      let outcome: ExternalServiceLoginOutcome;
      try {
        outcome = await login(
          buildApplicationCredentialLoginParams(appId, service, params),
        );
      } catch {
        throw new Error(loginFailed);
      }
      if (outcome.type === ExternalServiceLoginOutcomeType.Success) {
        await refresh();
        return true;
      }
      if (outcome.type === ExternalServiceLoginOutcomeType.Cancelled)
        return false;
      const messages: Partial<Record<ExternalServiceLoginOutcomeType, string>> =
        {
          [ExternalServiceLoginOutcomeType.PopupBlocked]: popupBlocked,
          [ExternalServiceLoginOutcomeType.AdminConsentRequired]:
            adminConsentRequired,
          [ExternalServiceLoginOutcomeType.OfflineUnavailable]:
            offlineUnavailable,
        };
      throw new Error(messages[outcome.type] ?? loginFailed);
    },
    [
      appId,
      services,
      login,
      refresh,
      loginFailed,
      popupBlocked,
      adminConsentRequired,
      offlineUnavailable,
    ],
  );

  const onLogout = useCallback(
    async (serviceId: string) => {
      const service = services.find((candidate) => candidate.id === serviceId);
      if (
        !service ||
        service.authenticationType === ExternalServiceAuthType.DialNative
      )
        return;
      try {
        await signOutExternalService(appId, serviceId, {
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType:
            service.authenticationType as ExternalServiceLogoutBodyDto['authenticationType'],
        });
      } catch {
        throw new Error(logoutFailed);
      }
      await refresh();
    },
    [appId, services, signOutExternalService, refresh, logoutFailed],
  );

  return { onLogin, onLogout };
};
