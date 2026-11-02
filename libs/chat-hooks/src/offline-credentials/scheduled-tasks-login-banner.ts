import { OfflineCredentialsGateStatus } from './useOfflineCredentialsGate/useOfflineCredentialsGate';
import { OfflineCredentialsLoginOutcomeType } from './useOfflineCredentialsLogin/useOfflineCredentialsLogin';

/** What the scheduled-tasks offline-credentials login banner shows. */
export enum ScheduledTasksLoginBannerState {
  /** The login prompt. */
  Shown = 'shown',
  /** A login is running. */
  LoginInProgress = 'login-in-progress',
  /** Retry prompt after the browser blocked the login popup. */
  RetryPopupBlocked = 'retry-popup-blocked',
  /** Retry prompt after the user closed the login popup. */
  RetryCancelled = 'retry-cancelled',
  /** Retry prompt after the login timed out. */
  RetryTimeout = 'retry-timeout',
  /** Retry prompt after the login failed. */
  RetryFailed = 'retry-failed',
}

const RETRY_STATES: Partial<
  Record<OfflineCredentialsLoginOutcomeType, ScheduledTasksLoginBannerState>
> = {
  [OfflineCredentialsLoginOutcomeType.PopupBlocked]:
    ScheduledTasksLoginBannerState.RetryPopupBlocked,
  [OfflineCredentialsLoginOutcomeType.Cancelled]:
    ScheduledTasksLoginBannerState.RetryCancelled,
  [OfflineCredentialsLoginOutcomeType.TimedOut]:
    ScheduledTasksLoginBannerState.RetryTimeout,
  [OfflineCredentialsLoginOutcomeType.Failure]:
    ScheduledTasksLoginBannerState.RetryFailed,
};

/** Returns the retry banner state an offline-credentials login outcome leaves, or `undefined` after a success. */
export const getScheduledTasksLoginRetryState = (
  outcome: OfflineCredentialsLoginOutcomeType,
): ScheduledTasksLoginBannerState | undefined =>
  outcome === OfflineCredentialsLoginOutcomeType.Success
    ? undefined
    : (RETRY_STATES[outcome] ?? ScheduledTasksLoginBannerState.RetryFailed);

/** Inputs of `resolveScheduledTasksLoginBannerState`. */
export interface ScheduledTasksLoginBannerInputs {
  /** Whether a login is running. */
  isLoggingIn: boolean;
  /** Retry state left by the last login, from `getScheduledTasksLoginRetryState`. */
  retryState: ScheduledTasksLoginBannerState | undefined;
  /** Status of the offline-credentials gate. */
  status: OfflineCredentialsGateStatus;
}

/** Returns what the login banner shows — in progress, the last retry state, or the prompt while credentials are missing — or `undefined` to hide it. */
export const resolveScheduledTasksLoginBannerState = ({
  isLoggingIn,
  retryState,
  status,
}: ScheduledTasksLoginBannerInputs):
  ScheduledTasksLoginBannerState | undefined => {
  if (isLoggingIn) return ScheduledTasksLoginBannerState.LoginInProgress;
  if (retryState) return retryState;
  if (
    status === OfflineCredentialsGateStatus.Available ||
    status === OfflineCredentialsGateStatus.Unavailable
  ) {
    return ScheduledTasksLoginBannerState.Shown;
  }
  return undefined;
};
