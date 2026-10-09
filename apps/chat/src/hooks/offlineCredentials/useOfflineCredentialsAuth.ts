import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { signOutOfflineCredentials } from '../../server-api/offline-credentials';
import type {
  OfflineCredentialsConnectSettings,
  OfflineCredentialsStatusResult,
} from './useOfflineCredentialsGate';
import {
  OfflineCredentialsLoginOutcomeType,
  useOfflineCredentialsLogin,
} from './useOfflineCredentialsLogin';

/**
 * Polite live-region key for each terminal login outcome — announced
 * identically by both consumers (the Scheduled Tasks login banner and the
 * Settings → Extensions tab).
 */
const LOGIN_ANNOUNCEMENT_KEYS: Record<
  OfflineCredentialsLoginOutcomeType,
  ScheduledTasksI18nKeys
> = {
  [OfflineCredentialsLoginOutcomeType.Success]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerSuccessAnnouncement,
  [OfflineCredentialsLoginOutcomeType.PopupBlocked]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerPopupBlockedMessage,
  [OfflineCredentialsLoginOutcomeType.Cancelled]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerCancelledMessage,
  [OfflineCredentialsLoginOutcomeType.TimedOut]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerTimeoutMessage,
  [OfflineCredentialsLoginOutcomeType.Failure]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerFailedMessage,
};

/** The slice of `useOfflineCredentialsGate` the auth flow drives and observes. */
export interface OfflineCredentialsAuthGate {
  connect: OfflineCredentialsConnectSettings | undefined;
  refetch: () => Promise<OfflineCredentialsStatusResult | null>;
}

export interface UseOfflineCredentialsAuthResult {
  isLoggingIn: boolean;
  /**
   * Terminal outcome of the most recent login attempt — `undefined` before
   * the first attempt and while one is in flight; reset at the start of every
   * new attempt.
   */
  loginOutcome: OfflineCredentialsLoginOutcomeType | undefined;
  /** Translated polite live-region text for the latest login/logout terminal event. */
  liveAnnouncement: string;
  isLoggingOut: boolean;
  /**
   * Starts the OAuth popup login with the gate's `connect` settings; no-ops
   * while no login is possible (gate reported no offline OAuth client).
   */
  logIn: () => void;
  /**
   * Revokes the stored offline-credentials grant and resolves whether a fresh
   * status refetch confirmed the disconnection — the outcome the caller's
   * confirmation dialog closes on.
   */
  logOut: () => Promise<boolean>;
}

/**
 * Shared login/logout orchestration for the external scheduler service's
 * offline credentials, consumed by both of its presentations — the Scheduled
 * Tasks login banner (`ScheduledTasksPage`) and the Settings → Extensions tab
 * (`ExtensionsTab`): tracks the in-flight flags, resolves every terminal login
 * outcome to the polite live-region announcement both surfaces announce, and
 * treats a fresh gate refetch as authoritative for reporting logout success.
 * Presentation stays with the caller: the banner maps `loginOutcome` onto its
 * retry states, the tab owns its confirmation-dialog state and flips its own
 * failure flag from `logOut`'s boolean.
 */
export const useOfflineCredentialsAuth = ({
  connect,
  refetch,
}: OfflineCredentialsAuthGate): UseOfflineCredentialsAuthResult => {
  const { t } = useTranslation();
  const { login } = useOfflineCredentialsLogin();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginOutcome, setLoginOutcome] = useState<
    OfflineCredentialsLoginOutcomeType | undefined
  >(undefined);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logIn = useCallback((): void => {
    if (connect == null) return;
    setIsLoggingIn(true);
    setLoginOutcome(undefined);
    setLiveAnnouncement('');

    const run = async (): Promise<void> => {
      const outcome = await login(connect, refetch);
      setIsLoggingIn(false);
      setLoginOutcome(outcome.type);
      setLiveAnnouncement(t(LOGIN_ANNOUNCEMENT_KEYS[outcome.type]));
    };
    void run();
  }, [connect, login, refetch, t]);

  /*
   * The POST's own 200 is a hint, and only a fresh gate refetch reporting
   * `connected: false` counts as logged out — mirrors the login flow's
   * refetch-is-authoritative rule.
   */
  const logOut = useCallback(async (): Promise<boolean> => {
    setIsLoggingOut(true);
    try {
      await signOutOfflineCredentials();
      const refreshed = await refetch();
      if (refreshed && !refreshed.connected) {
        setLiveAnnouncement(
          t(ScheduledTasksI18nKeys.DisconnectSuccessAnnouncement),
        );
        return true;
      }
      setLiveAnnouncement(t(ScheduledTasksI18nKeys.DisconnectFailedMessage));
      return false;
    } catch {
      setLiveAnnouncement(t(ScheduledTasksI18nKeys.DisconnectFailedMessage));
      return false;
    } finally {
      setIsLoggingOut(false);
    }
  }, [refetch, t]);

  return {
    isLoggingIn,
    loginOutcome,
    liveAnnouncement,
    isLoggingOut,
    logIn,
    logOut,
  };
};
