import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SigninInterruptDialogProps,
  SigninInterruptDialogRow,
} from '../../../models/signin-interrupt-dialog';
import { SigninInterruptDialog } from '../SigninInterruptDialog';

const makeRow = (
  overrides: Partial<SigninInterruptDialogRow> = {},
): SigninInterruptDialogRow => ({
  id: 'evt-1',
  displayName: 'My Toolset',
  apiKey: '',
  isProcessing: false,
  canSubmitLogin: true,
  requiresApiKey: false,
  requiresNoCredentials: false,
  showDialNativeHint: false,
  ...overrides,
});

const onApiKeyChange = vi.fn();
const onLogin = vi.fn();
const onDecline = vi.fn();
const onDeclineAll = vi.fn();
const onOfflineUsageConsentChange = vi.fn();

const renderDialog = (props: Partial<SigninInterruptDialogProps> = {}) =>
  render(
    <SigninInterruptDialog
      rows={[makeRow()]}
      offlineUsageConsent
      onOfflineUsageConsentChange={onOfflineUsageConsentChange}
      onApiKeyChange={onApiKeyChange}
      onLogin={onLogin}
      onDecline={onDecline}
      onDeclineAll={onDeclineAll}
      {...props}
    />,
  );

describe('SigninInterruptDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there are no rows', () => {
    const { container } = renderDialog({ rows: [] });
    expect(container.innerHTML).toBe('');
  });

  it('renders the heading, description and the row name with its version', () => {
    renderDialog({ rows: [makeRow({ displayVersion: '1.0' })] });

    expect(
      screen.getByRole('dialog', { name: 'Sign-in required' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'One or more tools or services need you to sign in before the conversation can continue.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('My Toolset')).toBeTruthy();
    expect(screen.getByText('1.0')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'My Toolset' })).toBeTruthy();
  });

  it('shows the pending count next to the heading only while more than one row is listed', () => {
    const { rerender } = renderDialog();
    expect(screen.queryByText('1')).toBeNull();

    rerender(
      <SigninInterruptDialog
        rows={[makeRow(), makeRow({ id: 'evt-2' }), makeRow({ id: 'evt-3' })]}
        offlineUsageConsent
        onOfflineUsageConsentChange={onOfflineUsageConsentChange}
        onApiKeyChange={onApiKeyChange}
        onLogin={onLogin}
        onDecline={onDecline}
        onDeclineAll={onDeclineAll}
      />,
    );

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('reports API key changes and disables Log in until the host allows submitting', async () => {
    const user = userEvent.setup();
    renderDialog({
      rows: [makeRow({ requiresApiKey: true, canSubmitLogin: false })],
    });

    expect(
      screen.getByRole('button', { name: 'Log in' }).hasAttribute('disabled'),
    ).toBe(true);
    /* The kit popup moves focus to itself after opening; typing earlier would land in the dialog, not the field. */
    await waitFor(() =>
      expect(screen.getByRole('dialog').matches(':focus')).toBe(true),
    );
    await user.type(screen.getByLabelText('API key'), 'k');

    expect(onApiKeyChange).toHaveBeenCalledWith('evt-1', 'k');
  });

  it('calls onLogin and onDecline with the row id', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await user.click(screen.getByRole('button', { name: 'Decline' }));

    expect(onLogin).toHaveBeenCalledWith('evt-1');
    expect(onDecline).toHaveBeenCalledWith('evt-1');
  });

  it('marks a processing row busy and disables its actions', () => {
    renderDialog({ rows: [makeRow({ isProcessing: true })] });

    expect(
      screen
        .getByRole('group', { name: 'My Toolset' })
        .getAttribute('aria-busy'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Decline' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Log in' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('announces a row error in its always-mounted alert region and retries the login', async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('');

    rerender(
      <SigninInterruptDialog
        rows={[makeRow({ errorMessage: 'Failed to log in.' })]}
        offlineUsageConsent
        onOfflineUsageConsentChange={onOfflineUsageConsentChange}
        onApiKeyChange={onApiKeyChange}
        onLogin={onLogin}
        onDecline={onDecline}
        onDeclineAll={onDeclineAll}
      />,
    );

    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert.textContent).toContain('Failed to log in.');
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onLogin).toHaveBeenCalledWith('evt-1');
  });

  it('shows the DIAL-native hint and the no-credentials label', () => {
    renderDialog({
      rows: [
        makeRow({ showDialNativeHint: true }),
        makeRow({ id: 'evt-2', requiresNoCredentials: true }),
      ],
    });

    expect(
      screen.getByText(
        "Connect your account for offline access. An administrator must separately approve this application's access.",
      ),
    ).toBeTruthy();
    expect(screen.getByText('No credentials required')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Decline' })).toHaveLength(1);
  });

  it('renders the footer actions only while more than one row is listed', async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog();
    expect(screen.queryByRole('button', { name: 'Decline all' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Log in to My Toolset' }),
    ).toBeNull();

    rerender(
      <SigninInterruptDialog
        rows={[makeRow(), makeRow({ id: 'evt-2' })]}
        offlineUsageConsent
        onOfflineUsageConsentChange={onOfflineUsageConsentChange}
        onApiKeyChange={onApiKeyChange}
        onLogin={onLogin}
        onDecline={onDecline}
        onDeclineAll={onDeclineAll}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Decline all' }));

    expect(onDeclineAll).toHaveBeenCalledOnce();
  });

  it('logs in to the first idle, submittable row needing credentials from the footer', async () => {
    const user = userEvent.setup();
    renderDialog({
      rows: [
        makeRow({ id: 'evt-1', displayName: 'Busy', isProcessing: true }),
        makeRow({
          id: 'evt-2',
          displayName: 'Free',
          requiresNoCredentials: true,
        }),
        makeRow({ id: 'evt-3', displayName: 'Keyless', canSubmitLogin: false }),
        makeRow({ id: 'evt-4', displayName: 'Jira' }),
      ],
      labels: { logInTo: (name) => `Sign in: ${name}` },
    });

    await user.click(screen.getByRole('button', { name: 'Sign in: Jira' }));

    expect(onLogin).toHaveBeenCalledWith('evt-4');
  });

  it('omits the footer login when no row can be submitted', () => {
    renderDialog({
      rows: [
        makeRow({ canSubmitLogin: false }),
        makeRow({ id: 'evt-2', isProcessing: true }),
      ],
    });

    expect(screen.getByRole('button', { name: 'Decline all' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Log in to/ })).toBeNull();
  });

  it('renders the offline-use consent only when asked and reports changes', async () => {
    const user = userEvent.setup();
    const { rerender } = renderDialog();
    expect(screen.queryByRole('checkbox')).toBeNull();

    rerender(
      <SigninInterruptDialog
        rows={[makeRow()]}
        isOfflineUsageConsentShown
        offlineUsageConsent
        onOfflineUsageConsentChange={onOfflineUsageConsentChange}
        onApiKeyChange={onApiKeyChange}
        onLogin={onLogin}
        onDecline={onDecline}
        onDeclineAll={onDeclineAll}
      />,
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Allow offline use' }),
    );

    expect(onOfflineUsageConsentChange).toHaveBeenCalledWith(false);
  });

  it('announces the status message in a polite region', () => {
    renderDialog({ statusMessage: 'Login succeeded for My Toolset.' });

    expect(screen.getByRole('status').textContent).toBe(
      'Login succeeded for My Toolset.',
    );
  });

  it('uses host labels, typography classes and color variables', () => {
    renderDialog({
      labels: { title: 'Anmelden', logIn: 'Einloggen' },
      nameClassName: 'dial-h3-text',
      colors: { nameText: 'red', rowHoverBackground: 'blue' },
    });

    expect(screen.getByRole('dialog', { name: 'Anmelden' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Einloggen' })).toBeTruthy();
    const name = screen.getByText('My Toolset');
    expect(name.className).toContain('dial-h3-text');
    expect(name.className).toMatch(/name/);
    // The vars sit on the unnamed content wrapper inside the portalled popup; no semantic query reaches it.
    // eslint-disable-next-line testing-library/no-node-access
    const vars = name.closest<HTMLElement>('[style]');
    expect(vars?.style.getPropertyValue('--cat-signin-name-text')).toBe('red');
    expect(
      vars?.style.getPropertyValue('--cat-signin-row-hover-background'),
    ).toBe('blue');
    expect(screen.getByRole('group', { name: 'My Toolset' }).className).toMatch(
      /row/,
    );
  });
});
