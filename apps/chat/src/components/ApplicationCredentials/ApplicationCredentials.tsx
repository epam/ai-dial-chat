import { ApplicationCredentials as CredentialsForms } from '@epam/ai-dial-catalog';
import {
  mapApplicationCredentials,
  useApplicationCredentialActions,
  useApplicationCredentials,
} from '@epam/ai-dial-chat-hooks';
import { useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApplicationCredentialsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ToolsetEditorI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../constants/translation-keys';
import { useExternalServiceLogin } from '../../hooks/externalServices/useExternalServiceLogin';
import {
  externalServicesApi,
  offlineCredentialsApi,
} from '../../server-api/api-client';
import { signOutExternalService } from '../../server-api/external-services';

interface ApplicationCredentialsProps {
  appId: string;
  showEmptyState?: boolean;
}

/** Adapts host authorization and localized copy to the library's credentials forms. */
export const ApplicationCredentials: FC<ApplicationCredentialsProps> = ({
  appId,
  showEmptyState = false,
}) => {
  const { t } = useTranslation();
  const { login } = useExternalServiceLogin();
  const { services, isLoading, hasError, isOfflineConnected, refresh } =
    useApplicationCredentials({
      appId,
      externalServicesClient: externalServicesApi,
      offlineCredentialsClient: offlineCredentialsApi,
    });

  const { onLogin, onLogout } = useApplicationCredentialActions({
    appId,
    services,
    login,
    signOutExternalService,
    refresh,
    labels: {
      loginFailed: t(ToolsetSigninI18nKeys.ErrorLoginFailed),
      popupBlocked: t(ToolsetSigninI18nKeys.ErrorPopupBlocked),
      adminConsentRequired: t(ToolsetSigninI18nKeys.AdminConsentRequired),
      offlineUnavailable: t(ToolsetSigninI18nKeys.OfflineUnavailable),
      logoutFailed: t(ToolsetEditorI18nKeys.ErrorLogoutFailed),
    },
  });

  const dialNativeHint = t(ToolsetSigninI18nKeys.DialNativeHint);
  const credentials = useMemo(
    () =>
      mapApplicationCredentials(services, {
        isOfflineConnected,
        dialNativeHint,
      }),
    [services, isOfflineConnected, dialNativeHint],
  );

  return (
    <CredentialsForms
      key={appId}
      services={credentials}
      isLoading={isLoading}
      hasError={hasError}
      showEmptyState={showEmptyState}
      onRetry={refresh}
      onLogin={onLogin}
      onLogout={onLogout}
      texts={{
        title: t(ApplicationCredentialsI18nKeys.Title),
        loading: t(BasicI18nKeys.Loading),
        loadError: t(ApplicationCredentialsI18nKeys.LoadError),
        retry: t(ButtonsI18nKeys.Retry),
        empty: t(ToolsetSigninI18nKeys.NoCredentialsRequired),
        sharedCredentials: t(ApplicationCredentialsI18nKeys.SharedCredentials),
        credentialsSignedInLabel: t(ApplicationCredentialsI18nKeys.SignedIn),
        credentialsSignedOutLabel: t(ApplicationCredentialsI18nKeys.SignedOut),
        loginActionLabel: t(ButtonsI18nKeys.LogIn),
        logoutActionLabel: t(ButtonsI18nKeys.LogOut),
        addApiKeyActionLabel: t(ButtonsI18nKeys.Add),
        deleteActionLabel: t(ButtonsI18nKeys.Delete),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        logoutConfirmMessage: t(ApplicationCredentialsI18nKeys.ConfirmLogout),
        deleteApiKeyConfirmMessage: () =>
          t(CatalogI18nKeys.CredentialsDeleteApiKeyConfirmMessagePersonal),
        apiKeyFieldLabel: t(ToolsetSigninI18nKeys.ApiKeyLabel),
        apiKeyConfiguredMessage: t(
          CatalogI18nKeys.CredentialsApiKeyConfiguredMessage,
        ),
        apiKeyRequiredErrorMessage: t(
          CatalogI18nKeys.CredentialsApiKeyRequiredErrorMessage,
        ),
        addingApiKeyStatusLabel: t(
          CatalogI18nKeys.CredentialsAddingApiKeyStatusLabel,
        ),
        offlineUsageConsent: t(ToolsetSigninI18nKeys.OfflineUsageConsent),
        offlineUsageConsentHint: t(
          ToolsetSigninI18nKeys.OfflineUsageConsentHint,
        ),
      }}
    />
  );
};
