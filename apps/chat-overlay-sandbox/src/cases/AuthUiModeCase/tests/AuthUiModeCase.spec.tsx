import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthUiModeCase from '../AuthUiModeCase';

const mocks = vi.hoisted(() => {
  const instanceMethods = {
    destroy: vi.fn(),
    setOverlayOptions: vi.fn().mockResolvedValue({ applied: true }),
  };
  return {
    instanceMethods,
    ChatOverlay: vi.fn().mockImplementation(function ChatOverlay() {
      return instanceMethods;
    }),
    getChatOverlayHost: vi.fn(() => 'https://chat.example.com'),
  };
});

vi.mock('@epam/ai-dial-chat-overlay', () => ({
  ChatOverlay: mocks.ChatOverlay,
  OverlayAuthUiMode: {
    External: 'external',
    SameWindow: 'sameWindow',
  },
  OverlayEventType: { Ready: '@DIAL_OVERLAY/READY' },
}));

vi.mock('../../../env', () => ({
  getChatOverlayHost: mocks.getChatOverlayHost,
}));

describe('AuthUiModeCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ChatOverlay.mockImplementation(function ChatOverlay() {
      return mocks.instanceMethods;
    });
    mocks.getChatOverlayHost.mockReturnValue('https://chat.example.com');
  });

  const selectProviderMode = async (
    user: ReturnType<typeof userEvent.setup>,
    fieldName: string,
    optionName: string,
  ) => {
    await user.click(screen.getByRole('combobox', { name: fieldName }));
    await user.click(await screen.findByRole('option', { name: optionName }));
  };

  it('constructs the overlay with two provider UI modes', () => {
    render(<AuthUiModeCase />);

    expect(mocks.ChatOverlay).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      domain: 'https://chat.example.com',
      loaderHideEvent: '@DIAL_OVERLAY/READY',
      auth: {
        providerUiModes: {
          keycloak: 'sameWindow',
          auth0: 'external',
        },
      },
    });
  });

  it('applies edited provider IDs and modes at runtime', async () => {
    const user = userEvent.setup();
    render(<AuthUiModeCase />);

    const firstProviderId = screen.getByLabelText('Provider 1 ID');
    await user.clear(firstProviderId);
    await user.type(firstProviderId, 'custom/provider');
    await selectProviderMode(user, 'Provider 1 mode', 'External');
    await selectProviderMode(user, 'Provider 2 mode', 'Same window');
    await user.click(
      screen.getByRole('button', { name: 'Apply auth settings' }),
    );

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      auth: {
        providerUiModes: {
          'custom/provider': 'external',
          auth0: 'sameWindow',
        },
      },
    });
  });

  it('omits blank provider IDs from the applied map', async () => {
    const user = userEvent.setup();
    render(<AuthUiModeCase />);

    await user.clear(screen.getByLabelText('Provider 2 ID'));
    await user.click(
      screen.getByRole('button', { name: 'Apply auth settings' }),
    );

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      auth: { providerUiModes: { keycloak: 'sameWindow' } },
    });
  });

  it('adds another provider field and applies its settings', async () => {
    const user = userEvent.setup();
    render(<AuthUiModeCase />);

    await user.click(screen.getByRole('button', { name: 'Add provider' }));
    expect(screen.getByText('3 providers configured')).toBeTruthy();

    await user.type(screen.getByLabelText('Provider 3 ID'), 'github');
    await selectProviderMode(user, 'Provider 3 mode', 'Same window');
    await user.click(
      screen.getByRole('button', { name: 'Apply auth settings' }),
    );

    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      auth: {
        providerUiModes: {
          keycloak: 'sameWindow',
          auth0: 'external',
          github: 'sameWindow',
        },
      },
    });
  });

  it('removes providers but keeps at least one field', async () => {
    const user = userEvent.setup();
    render(<AuthUiModeCase />);

    await user.click(screen.getByRole('button', { name: 'Remove provider 2' }));

    expect(screen.getByText('1 provider configured')).toBeTruthy();
    expect(screen.queryByLabelText('Provider 2 ID')).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Remove provider 1',
      }).disabled,
    ).toBe(true);
  });

  it('clears all provider settings at runtime', async () => {
    const user = userEvent.setup();
    render(<AuthUiModeCase />);

    await user.click(
      screen.getByRole('button', { name: 'Clear provider settings' }),
    );

    expect(screen.getByText('0 providers configured')).toBeTruthy();
    expect(screen.queryByLabelText('Provider 1 ID')).toBeNull();
    expect(mocks.instanceMethods.setOverlayOptions).toHaveBeenCalledWith({
      auth: { providerUiModes: {} },
    });
  });
});
