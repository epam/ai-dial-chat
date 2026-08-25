import { memo, useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import OfflineCredentialsLoginModal, {
  OfflineCredentialsModalState,
} from '../../components/OfflineCredentialsLoginModal/OfflineCredentialsLoginModal';
import {
  ButtonsI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
} from '../../hooks/offlineCredentials/useOfflineCredentialsGate';
import {
  OfflineCredentialsLoginOutcomeType,
  useOfflineCredentialsLogin,
} from '../../hooks/offlineCredentials/useOfflineCredentialsLogin';

const resolveModalState = ({
  isLoggingIn,
  retryState,
  status,
  isDismissed,
}: {
  isLoggingIn: boolean;
  retryState: OfflineCredentialsModalState | undefined;
  status: OfflineCredentialsGateStatus;
  isDismissed: boolean;
}): OfflineCredentialsModalState | undefined => {
  if (isLoggingIn) return OfflineCredentialsModalState.LoginInProgress;
  if (retryState) return retryState;
  if (status === OfflineCredentialsGateStatus.Available && !isDismissed) {
    return OfflineCredentialsModalState.Available;
  }
  return undefined;
};

/**
 * Shared parent route element for the four Scheduled Task routes
 * (`ROUTES.ScheduledTasks`/`ScheduledTaskCreate`/`ScheduledTaskDetail`/
 * `ScheduledTaskEdit`). Renders the page subtree via `<Outlet />` plus a
 * login-required modal driven by `useOfflineCredentialsGate`/
 * `useOfflineCredentialsLogin`, per design.md Decision 3. The OAuth callback
 * route (`ROUTES.ToolsetSignIn`) is a sibling outside this subtree in
 * `app.tsx`, so it never renders this gate.
 */
const ScheduledTasksRouteGate: FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { status, connect, refetch } = useOfflineCredentialsGate();
  const { login } = useOfflineCredentialsLogin();
  const [retryState, setRetryState] = useState<
    OfflineCredentialsModalState | undefined
  >(undefined);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [isDismissed, setIsDismissed] = useState(false);

  /*
   * A dismissal only hides the modal for the current route entry — entering
   * a new Scheduled Tasks route (even within this same mounted layout, e.g.
   * navigating list -> detail) gets a fresh chance to show it, matching the
   * gate's own per-pathname refetch and design.md's "not one-time-only"
   * nudge behavior.
   */
  useEffect(() => {
    setIsDismissed(false);
    setRetryState(undefined);
    setIsLoggingIn(false);
  }, [pathname]);

  const handleClose = useCallback(() => {
    setIsDismissed(true);
    setRetryState(undefined);
  }, []);

  const handleLogIn = useCallback(() => {
    if (!connect) return;
    setIsLoggingIn(true);
    setRetryState(undefined);
    setLiveAnnouncement('');

    const run = async (): Promise<void> => {
      const outcome = await login(connect, refetch);
      setIsLoggingIn(false);

      switch (outcome.type) {
        case OfflineCredentialsLoginOutcomeType.Success:
          setLiveAnnouncement(
            t(
              ScheduledTasksI18nKeys.OfflineCredentialsModalSuccessAnnouncement,
            ),
          );
          setIsDismissed(false);
          setRetryState(undefined);
          break;
        case OfflineCredentialsLoginOutcomeType.PopupBlocked:
          setRetryState(OfflineCredentialsModalState.RetryPopupBlocked);
          break;
        case OfflineCredentialsLoginOutcomeType.Cancelled:
          setRetryState(OfflineCredentialsModalState.RetryCancelled);
          break;
        case OfflineCredentialsLoginOutcomeType.TimedOut:
          setRetryState(OfflineCredentialsModalState.RetryTimeout);
          break;
        case OfflineCredentialsLoginOutcomeType.Failure:
        default:
          setRetryState(OfflineCredentialsModalState.RetryFailed);
          break;
      }
    };
    void run();
  }, [connect, login, refetch, t]);

  const modalState = resolveModalState({
    isLoggingIn,
    retryState,
    status,
    isDismissed,
  });

  return (
    <>
      <Outlet />
      <OfflineCredentialsLoginModal
        state={modalState}
        title={t(ScheduledTasksI18nKeys.OfflineCredentialsModalTitle)}
        body={t(ScheduledTasksI18nKeys.OfflineCredentialsModalBody)}
        loginButtonLabel={t(ButtonsI18nKeys.LogIn)}
        dismissButtonLabel={t(
          ScheduledTasksI18nKeys.OfflineCredentialsModalDismissButtonLabel,
        )}
        closeAriaLabel={t(
          ScheduledTasksI18nKeys.OfflineCredentialsModalCloseAriaLabel,
        )}
        retryButtonLabel={t(ButtonsI18nKeys.Retry)}
        loggingInAriaLabel={t(
          ScheduledTasksI18nKeys.OfflineCredentialsModalLoggingInAriaLabel,
        )}
        popupBlockedMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsModalPopupBlockedMessage,
        )}
        cancelledMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsModalCancelledMessage,
        )}
        timeoutMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsModalTimeoutMessage,
        )}
        failedMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsModalFailedMessage,
        )}
        liveAnnouncement={liveAnnouncement}
        onLogIn={handleLogIn}
        onClose={handleClose}
      />
    </>
  );
};

export default memo(ScheduledTasksRouteGate);
