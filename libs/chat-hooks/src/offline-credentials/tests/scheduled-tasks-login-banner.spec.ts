import { describe, expect, it } from 'vitest';
import {
  getScheduledTasksLoginRetryState,
  resolveScheduledTasksLoginBannerState,
  ScheduledTasksLoginBannerState,
} from '../scheduled-tasks-login-banner';
import { OfflineCredentialsGateStatus } from '../useOfflineCredentialsGate/useOfflineCredentialsGate';
import { OfflineCredentialsLoginOutcomeType } from '../useOfflineCredentialsLogin/useOfflineCredentialsLogin';

describe('getScheduledTasksLoginRetryState', () => {
  it('maps each failed outcome to its retry state', () => {
    expect(
      getScheduledTasksLoginRetryState(
        OfflineCredentialsLoginOutcomeType.PopupBlocked,
      ),
    ).toBe(ScheduledTasksLoginBannerState.RetryPopupBlocked);
    expect(
      getScheduledTasksLoginRetryState(
        OfflineCredentialsLoginOutcomeType.Cancelled,
      ),
    ).toBe(ScheduledTasksLoginBannerState.RetryCancelled);
    expect(
      getScheduledTasksLoginRetryState(
        OfflineCredentialsLoginOutcomeType.TimedOut,
      ),
    ).toBe(ScheduledTasksLoginBannerState.RetryTimeout);
    expect(
      getScheduledTasksLoginRetryState(
        OfflineCredentialsLoginOutcomeType.Failure,
      ),
    ).toBe(ScheduledTasksLoginBannerState.RetryFailed);
  });

  it('leaves no retry state after a success', () => {
    expect(
      getScheduledTasksLoginRetryState(
        OfflineCredentialsLoginOutcomeType.Success,
      ),
    ).toBeUndefined();
  });
});

describe('resolveScheduledTasksLoginBannerState', () => {
  it('shows progress while logging in, over any retry state', () => {
    expect(
      resolveScheduledTasksLoginBannerState({
        isLoggingIn: true,
        retryState: ScheduledTasksLoginBannerState.RetryFailed,
        status: OfflineCredentialsGateStatus.Available,
      }),
    ).toBe(ScheduledTasksLoginBannerState.LoginInProgress);
  });

  it('keeps the last retry state', () => {
    expect(
      resolveScheduledTasksLoginBannerState({
        isLoggingIn: false,
        retryState: ScheduledTasksLoginBannerState.RetryTimeout,
        status: OfflineCredentialsGateStatus.Hidden,
      }),
    ).toBe(ScheduledTasksLoginBannerState.RetryTimeout);
  });

  it('prompts while credentials are available or unavailable, and hides otherwise', () => {
    const resolve = (status: OfflineCredentialsGateStatus) =>
      resolveScheduledTasksLoginBannerState({
        isLoggingIn: false,
        retryState: undefined,
        status,
      });

    expect(resolve(OfflineCredentialsGateStatus.Available)).toBe(
      ScheduledTasksLoginBannerState.Shown,
    );
    expect(resolve(OfflineCredentialsGateStatus.Unavailable)).toBe(
      ScheduledTasksLoginBannerState.Shown,
    );
    expect(resolve(OfflineCredentialsGateStatus.Hidden)).toBeUndefined();
  });
});
