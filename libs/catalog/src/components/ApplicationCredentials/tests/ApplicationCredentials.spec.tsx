import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  ApplicationCredential,
  ApplicationCredentialsProps,
} from '../../../models/application-credentials';
import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { ApplicationCredentials } from '../ApplicationCredentials';

const service: ApplicationCredential = {
  id: 'finance',
  name: 'Finance',
  authenticationType: ToolsetAuthenticationType.ApiKey,
  status: CredentialStatus.SignedOut,
  canLogout: true,
  canConsentToOfflineUsage: true,
};
const props = (): ApplicationCredentialsProps => ({
  services: [service],
  onRetry: vi.fn(),
  onLogin: vi.fn().mockResolvedValue(true),
  onLogout: vi.fn().mockResolvedValue(undefined),
});

describe('ApplicationCredentials', () => {
  it('uses the toolset API-key Add action, validates empty input, and submits unchecked consent by default', async () => {
    const user = userEvent.setup();
    const options = props();
    render(<ApplicationCredentials {...options} />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert').textContent).toBe('API key is required.');
    expect(options.onLogin).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('API key'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(options.onLogin).toHaveBeenCalledWith('finance', {
      apiKey: 'secret',
      offlineUsageConsent: false,
    });
    expect(screen.getByLabelText('API key')).toHaveProperty('value', '');
  });

  it('keeps cancelled and failed drafts, displays the supplied error, and allows retry', async () => {
    const user = userEvent.setup();
    const options = props();
    vi.mocked(options.onLogin)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('Access denied'));
    render(<ApplicationCredentials {...options} />);
    const input = screen.getByLabelText('API key');
    await user.type(input, 'secret');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(input).toHaveProperty('value', 'secret');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert').textContent).toBe('Access denied');
    expect(input).toHaveProperty('value', 'secret');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('requires confirmation to delete a configured key and supports cancelling removal', async () => {
    const user = userEvent.setup();
    const options = props();
    render(
      <ApplicationCredentials
        {...options}
        services={[{ ...service, status: CredentialStatus.SignedIn }]}
      />,
    );
    expect(screen.getByText('Key has been configured')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(options.onLogout).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(options.onLogout).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen
      .getAllByRole('button', { name: 'Delete' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!confirm) throw new Error('Missing delete confirmation');
    await user.click(confirm);
    expect(options.onLogout).toHaveBeenCalledWith('finance');
  });

  it('keeps other service drafts and actions available while one redirect login is pending', async () => {
    const user = userEvent.setup();
    let resolveLogin!: (success: boolean) => void;
    const options = props();
    vi.mocked(options.onLogin).mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    render(
      <ApplicationCredentials
        {...options}
        services={[
          service,
          {
            ...service,
            id: 'git',
            name: 'Git',
            authenticationType: ToolsetAuthenticationType.OAuth,
          },
        ]}
      />,
    );
    await user.type(screen.getByLabelText('API key'), 'draft');
    const git = within(screen.getByRole('group', { name: 'Git' }));
    await user.click(git.getByRole('button', { name: 'Log in' }));
    expect(git.getByRole('button', { name: 'Log in' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(git.getByRole('checkbox')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('API key')).toHaveProperty('value', 'draft');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty(
      'disabled',
      false,
    );
    await act(async () => resolveLogin(false));
  });

  it('renders shared credentials as informational and never offers removal for a non-removable connection', () => {
    render(
      <ApplicationCredentials
        {...props()}
        services={[
          { ...service, hasSharedCredentials: true },
          {
            ...service,
            id: 'native',
            name: 'Native',
            authenticationType: ToolsetAuthenticationType.OAuth,
            status: CredentialStatus.SignedIn,
            canLogout: false,
            canConsentToOfflineUsage: false,
          },
        ]}
      />,
    );
    expect(
      screen.getByText('Shared credentials are available for this service.'),
    ).toBeTruthy();
    const native = within(screen.getByRole('group', { name: 'Native' }));
    expect(native.queryByRole('button')).toBeNull();
    expect(native.getByRole('status').textContent).toBe('Signed in');
  });
});
