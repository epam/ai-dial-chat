import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScheduledTasksLoginBanner, {
  ScheduledTasksLoginBannerState,
} from '../ScheduledTasksLoginBanner';

const BASE_PROPS = {
  title: 'Log in required.',
  body: 'Scheduled tasks need authorization to run offline.',
  loginButtonLabel: 'Log in',
  retryButtonLabel: 'Retry',
  loggingInLabel: 'Logging in…',
  popupBlockedMessage: 'The login popup was blocked.',
  cancelledMessage: 'Login was cancelled.',
  timeoutMessage: 'The login attempt timed out.',
  failedMessage: 'Login failed.',
  liveAnnouncement: '',
  onLogIn: vi.fn(),
};

describe('ScheduledTasksLoginBanner', () => {
  it('renders nothing visible when state is undefined', () => {
    render(<ScheduledTasksLoginBanner {...BASE_PROPS} state={undefined} />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(BASE_PROPS.title)).toBeNull();
  });

  it('announces a pending liveAnnouncement even while hidden', () => {
    render(
      <ScheduledTasksLoginBanner
        {...BASE_PROPS}
        state={undefined}
        liveAnnouncement="You're logged in."
      />,
    );

    expect(screen.getByText("You're logged in.")).toBeTruthy();
  });

  it('shows the title, body, and Log in button in the Shown state', () => {
    render(
      <ScheduledTasksLoginBanner
        {...BASE_PROPS}
        state={ScheduledTasksLoginBannerState.Shown}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(BASE_PROPS.title);
    expect(alert.textContent).toContain(BASE_PROPS.body);
    expect(
      screen.getByRole('button', { name: BASE_PROPS.loginButtonLabel }),
    ).toBeTruthy();
  });

  it('calls onLogIn when the button is clicked in the Shown state', async () => {
    const onLogIn = vi.fn();
    render(
      <ScheduledTasksLoginBanner
        {...BASE_PROPS}
        onLogIn={onLogIn}
        state={ScheduledTasksLoginBannerState.Shown}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: BASE_PROPS.loginButtonLabel }),
    );

    expect(onLogIn).toHaveBeenCalledOnce();
  });

  it('shows the warning without a login action when Core cannot offer login', () => {
    render(
      <ScheduledTasksLoginBanner
        {...BASE_PROPS}
        state={ScheduledTasksLoginBannerState.Shown}
        onLogIn={undefined}
      />,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables the button and swaps its label during LoginInProgress', () => {
    render(
      <ScheduledTasksLoginBanner
        {...BASE_PROPS}
        state={ScheduledTasksLoginBannerState.LoginInProgress}
      />,
    );

    expect(
      screen.queryByRole('button', { name: BASE_PROPS.loginButtonLabel }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: BASE_PROPS.loggingInLabel,
      }) as HTMLButtonElement,
    ).toHaveProperty('disabled', true);
  });

  it.each([
    [
      ScheduledTasksLoginBannerState.RetryPopupBlocked,
      BASE_PROPS.popupBlockedMessage,
    ],
    [
      ScheduledTasksLoginBannerState.RetryCancelled,
      BASE_PROPS.cancelledMessage,
    ],
    [ScheduledTasksLoginBannerState.RetryTimeout, BASE_PROPS.timeoutMessage],
    [ScheduledTasksLoginBannerState.RetryFailed, BASE_PROPS.failedMessage],
  ])(
    'shows the Retry button and announces the %s message without changing the visible title/body',
    (state, message) => {
      render(<ScheduledTasksLoginBanner {...BASE_PROPS} state={state} />);

      expect(
        screen.getByRole('button', { name: BASE_PROPS.retryButtonLabel }),
      ).toBeTruthy();
      expect(screen.getByText(message)).toBeTruthy();

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(BASE_PROPS.title);
      expect(alert.textContent).toContain(BASE_PROPS.body);
    },
  );

  it('calls onLogIn (as the retry action) when Retry is clicked', async () => {
    const onLogIn = vi.fn();
    render(
      <ScheduledTasksLoginBanner
        {...BASE_PROPS}
        onLogIn={onLogIn}
        state={ScheduledTasksLoginBannerState.RetryFailed}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: BASE_PROPS.retryButtonLabel }),
    );

    expect(onLogIn).toHaveBeenCalledOnce();
  });

  it('renders the container as an assertive alert region when shown', () => {
    render(
      <ScheduledTasksLoginBanner
        {...BASE_PROPS}
        state={ScheduledTasksLoginBannerState.Shown}
      />,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
