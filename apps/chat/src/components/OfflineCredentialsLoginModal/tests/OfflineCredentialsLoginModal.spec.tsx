import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import OfflineCredentialsLoginModal, {
  OfflineCredentialsModalState,
} from '../OfflineCredentialsLoginModal';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  PopupSize: { Sm: 'sm', Md: 'md' },
  Popup: ({
    open,
    header,
    ariaLabel,
    children,
    footer,
    onClose,
    closeAriaLabel,
  }: {
    open: boolean;
    header?: ReactNode;
    ariaLabel?: string;
    children?: ReactNode;
    footer?: ReactNode;
    onClose?: () => void;
    closeAriaLabel?: string;
  }) =>
    open ? (
      <div role="dialog" aria-label={ariaLabel}>
        <h2>{header}</h2>
        {onClose && (
          <button type="button" aria-label={closeAriaLabel} onClick={onClose} />
        )}
        {children}
        {footer}
      </div>
    ) : null,
  NeutralButton: ({
    label,
    onClick,
    disabled,
  }: {
    label?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  PrimaryButton: ({
    label,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: {
    label?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  ),
}));

const BASE_PROPS = {
  title: 'Log in required for scheduled tasks',
  body: 'You need to log in once.',
  loginButtonLabel: 'Log in',
  dismissButtonLabel: 'Not now',
  closeAriaLabel: 'Close login required dialog',
  retryButtonLabel: 'Retry',
  loggingInAriaLabel: 'Logging in…',
  popupBlockedMessage: 'The login popup was blocked.',
  cancelledMessage: 'Login was cancelled.',
  timeoutMessage: 'The login attempt timed out.',
  failedMessage: 'Login failed.',
  liveAnnouncement: '',
  onLogIn: vi.fn(),
  onClose: vi.fn(),
};

describe('OfflineCredentialsLoginModal', () => {
  it('renders nothing visible when state is undefined', () => {
    render(<OfflineCredentialsLoginModal {...BASE_PROPS} state={undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('announces a pending success message even while closed', () => {
    render(
      <OfflineCredentialsLoginModal
        {...BASE_PROPS}
        state={undefined}
        liveAnnouncement="You're logged in."
      />,
    );
    expect(screen.getByText("You're logged in.")).toBeTruthy();
  });

  it('shows the login-required dialog in the Available state', () => {
    render(
      <OfflineCredentialsLoginModal
        {...BASE_PROPS}
        state={OfflineCredentialsModalState.Available}
      />,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: BASE_PROPS.loginButtonLabel }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: BASE_PROPS.dismissButtonLabel }),
    ).toBeTruthy();
  });

  it('calls onLogIn when the primary button is clicked in the Available state', async () => {
    const onLogIn = vi.fn();
    render(
      <OfflineCredentialsLoginModal
        {...BASE_PROPS}
        onLogIn={onLogIn}
        state={OfflineCredentialsModalState.Available}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: BASE_PROPS.loginButtonLabel }),
    );

    expect(onLogIn).toHaveBeenCalledOnce();
  });

  it('calls onClose when the dismiss button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <OfflineCredentialsLoginModal
        {...BASE_PROPS}
        onClose={onClose}
        state={OfflineCredentialsModalState.Available}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: BASE_PROPS.dismissButtonLabel }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables both buttons and marks the body busy during LoginInProgress', () => {
    render(
      <OfflineCredentialsLoginModal
        {...BASE_PROPS}
        state={OfflineCredentialsModalState.LoginInProgress}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: BASE_PROPS.dismissButtonLabel,
      }) as HTMLButtonElement,
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', {
        name: BASE_PROPS.loggingInAriaLabel,
      }) as HTMLButtonElement,
    ).toHaveProperty('disabled', true);
  });

  it('does not render a close button while logging in', () => {
    render(
      <OfflineCredentialsLoginModal
        {...BASE_PROPS}
        state={OfflineCredentialsModalState.LoginInProgress}
      />,
    );
    expect(
      screen.queryByRole('button', { name: BASE_PROPS.closeAriaLabel }),
    ).toBeNull();
  });

  it.each([
    [
      OfflineCredentialsModalState.RetryPopupBlocked,
      BASE_PROPS.popupBlockedMessage,
    ],
    [OfflineCredentialsModalState.RetryCancelled, BASE_PROPS.cancelledMessage],
    [OfflineCredentialsModalState.RetryTimeout, BASE_PROPS.timeoutMessage],
    [OfflineCredentialsModalState.RetryFailed, BASE_PROPS.failedMessage],
  ])(
    'announces the %s message and shows the retry button',
    (state, message) => {
      render(<OfflineCredentialsLoginModal {...BASE_PROPS} state={state} />);

      expect(screen.getByText(message)).toBeTruthy();
      expect(
        screen.getByRole('button', { name: BASE_PROPS.retryButtonLabel }),
      ).toBeTruthy();
    },
  );

  it('calls onLogIn (as the retry action) when the primary button is clicked in a retry state', async () => {
    const onLogIn = vi.fn();
    render(
      <OfflineCredentialsLoginModal
        {...BASE_PROPS}
        onLogIn={onLogIn}
        state={OfflineCredentialsModalState.RetryFailed}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: BASE_PROPS.retryButtonLabel }),
    );

    expect(onLogIn).toHaveBeenCalledOnce();
  });
});
