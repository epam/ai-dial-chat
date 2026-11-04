import {
  type SigninInterruptDialogLabels,
  type SigninInterruptDialogRow,
  SigninInterruptDialog as SigninInterruptDialogView,
} from '@epam/ai-dial-catalog';
import {
  type SigninInterruptAnnouncement,
  SigninInterruptAnnouncementKind,
  SigninInterruptRowError,
  useSigninInterrupt,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ToolsetSigninI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useClientChannel } from '../../context/ClientChannelContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useExternalServiceLogin } from '../../hooks/externalServices/useExternalServiceLogin';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useToolsetLogin } from '../../hooks/toolsets/useToolsetLogin';
import { useUiFeature } from '../../hooks/useUiFeature';
import { getExternalService } from '../../server-api/external-services';
import { getToolset } from '../../server-api/toolsets';
import { PRIMARY_LOCALE } from '../../utils/locale';

const getRowErrorKey = (
  error: SigninInterruptRowError,
): ToolsetSigninI18nKeys => {
  switch (error) {
    case SigninInterruptRowError.PopupBlocked:
      return ToolsetSigninI18nKeys.ErrorPopupBlocked;
    case SigninInterruptRowError.DeclineFailed:
      return ToolsetSigninI18nKeys.ErrorDeclineFailed;
    case SigninInterruptRowError.AdminConsentRequired:
      return ToolsetSigninI18nKeys.AdminConsentRequired;
    case SigninInterruptRowError.OfflineUnavailable:
      return ToolsetSigninI18nKeys.OfflineUnavailable;
    default:
      return ToolsetSigninI18nKeys.ErrorLoginFailed;
  }
};

const getAnnouncementKey = (
  announcement: SigninInterruptAnnouncement,
): ToolsetSigninI18nKeys =>
  announcement.kind === SigninInterruptAnnouncementKind.Declined
    ? ToolsetSigninI18nKeys.StatusDeclineSuccess
    : ToolsetSigninI18nKeys.StatusLoginSuccess;

/**
 * Global, non-dismissible dialog that surfaces pending DIAL-Core-pushed
 * `toolset/signin` and `external-service/signin` events (raised mid-completion
 * when a tool call or an application's external service needs fresh
 * credentials) and lets the user log in or decline each one.
 */
const SigninInterruptDialog: FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { pendingEvents, reportEvent } = useClientChannel();
  const { toolsets, refetchToolsets } = useDeployments();
  const { login: loginToolset } = useToolsetLogin();
  const { login: loginExternalService } = useExternalServiceLogin();
  const isLiveChatInteractionUiEnabled = useUiFeature(
    OverlayFeature.LiveChatInteraction,
  );
  const isLiveChatInteractionCapable = useFeatureFlag('liveChatInteraction');

  const {
    rows,
    announcement,
    offlineUsageConsent,
    setOfflineUsageConsent,
    isOfflineUsageConsentShown,
    changeApiKey,
    login,
    decline,
    declineAll,
  } = useSigninInterrupt({
    pendingEvents,
    toolsets,
    activeLocale: language,
    primaryLocale: PRIMARY_LOCALE,
    getToolset,
    getExternalService,
    loginToolset,
    loginExternalService,
    refetchToolsets,
    reportEvent,
  });

  const labels = useMemo(
    (): SigninInterruptDialogLabels => ({
      title: t(ToolsetSigninI18nKeys.DialogTitle),
      description: t(ToolsetSigninI18nKeys.DialogDescription),
      declineAll: t(ToolsetSigninI18nKeys.DeclineAll),
      decline: t(ToolsetSigninI18nKeys.RowDecline),
      logIn: t(ButtonsI18nKeys.LogIn),
      retry: t(ButtonsI18nKeys.Retry),
      apiKeyLabel: t(ToolsetSigninI18nKeys.ApiKeyLabel),
      apiKeyPlaceholder: t(ToolsetSigninI18nKeys.ApiKeyPlaceholder),
      dialNativeHint: t(ToolsetSigninI18nKeys.DialNativeHint),
      noCredentialsRequired: t(ToolsetSigninI18nKeys.NoCredentialsRequired),
      offlineUsageConsent: t(ToolsetSigninI18nKeys.OfflineUsageConsent),
      offlineUsageConsentHint: t(ToolsetSigninI18nKeys.OfflineUsageConsentHint),
    }),
    [t],
  );

  const dialogRows = useMemo(
    (): SigninInterruptDialogRow[] =>
      rows.map((row) => ({
        id: row.event.id,
        displayName: row.info.displayName,
        displayVersion: row.info.displayVersion,
        apiKey: row.apiKey,
        isProcessing: row.isProcessing,
        canSubmitLogin: row.canSubmitLogin,
        requiresApiKey: row.requiresApiKey,
        requiresNoCredentials: row.requiresNoCredentials,
        showDialNativeHint: row.isDialNative,
        errorMessage: row.error ? t(getRowErrorKey(row.error)) : undefined,
      })),
    [rows, t],
  );

  if (!isLiveChatInteractionUiEnabled || !isLiveChatInteractionCapable) {
    return null;
  }

  return (
    <SigninInterruptDialogView
      rows={dialogRows}
      statusMessage={
        announcement
          ? t(getAnnouncementKey(announcement), { name: announcement.name })
          : ''
      }
      isOfflineUsageConsentShown={isOfflineUsageConsentShown}
      offlineUsageConsent={offlineUsageConsent}
      onOfflineUsageConsentChange={setOfflineUsageConsent}
      onApiKeyChange={changeApiKey}
      onLogin={login}
      onDecline={decline}
      onDeclineAll={declineAll}
      labels={labels}
    />
  );
};

export default memo(SigninInterruptDialog);
