import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
} from '../../../constants/translation-keys';
import { OverlayExternalLoginStatus } from '../../../hooks/auth/useOverlayExternalLogin';
import { useOverlayProviderLogin } from '../../../hooks/auth/useOverlayProviderLogin';
import OverlayLoginGate from '../OverlayLoginGate';

vi.mock('../../../hooks/auth/useOverlayProviderLogin', () => ({
  useOverlayProviderLogin: vi.fn(),
}));

describe('OverlayLoginGate', () => {
  const openLogin = vi.fn();
  const openProviderLogin = vi.fn();
  const retryLoadProviders = vi.fn();
  const mockUseOverlayProviderLogin = vi.mocked(useOverlayProviderLogin);

  const mockHook = (
    overrides: Partial<ReturnType<typeof useOverlayProviderLogin>> = {},
  ) => {
    mockUseOverlayProviderLogin.mockReturnValue({
      hasProviderConfiguration: false,
      providers: null,
      isLoadingProviders: false,
      hasProviderError: false,
      retryLoadProviders,
      openProviderLogin,
      openLogin,
      externalLoginStatus: OverlayExternalLoginStatus.Idle,
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHook();
  });

  it('renders the single login action when no provider configuration exists', () => {
    render(<OverlayLoginGate />);

    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
    ).toBeTruthy();
    expect(
      screen.queryByText(AuthI18nKeys.OverlayProviderPickerLoading),
    ).toBeNull();
  });

  it('opens the generic login flow from the single action', () => {
    render(<OverlayLoginGate />);

    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
    );

    expect(openLogin).toHaveBeenCalledOnce();
  });

  it('announces provider loading and marks the gate busy', () => {
    mockHook({
      hasProviderConfiguration: true,
      isLoadingProviders: true,
    });

    const { container } = render(<OverlayLoginGate />);

    expect(
      screen.getByText(AuthI18nKeys.OverlayProviderPickerLoading),
    ).toBeTruthy();
    // The root <section> has no accessible name/role of its own (it's a plain
    // wrapper), so there is no semantic query that can reach its aria-busy
    // attribute; falling back to container access is the only option here.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('announces provider errors and retries loading', () => {
    mockHook({
      hasProviderConfiguration: true,
      hasProviderError: true,
    });

    render(<OverlayLoginGate />);
    expect(screen.getByRole('alert').textContent).toBe(
      AuthI18nKeys.OverlayProvidersError,
    );

    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Retry }),
    );
    expect(retryLoadProviders).toHaveBeenCalledOnce();
  });

  it('renders one action per provider and starts the selected provider flow', () => {
    mockHook({
      hasProviderConfiguration: true,
      providers: [
        { id: 'keycloak', label: 'Keycloak' },
        { id: 'entra', label: 'Microsoft Entra ID' },
      ],
    });

    render(<OverlayLoginGate />);

    fireEvent.click(screen.getByRole('button', { name: 'Keycloak' }));
    expect(
      screen.getByRole('button', { name: 'Microsoft Entra ID' }),
    ).toBeTruthy();
    expect(openProviderLogin).toHaveBeenCalledWith('keycloak');
  });

  it('allows replacing an external login while it is waiting', () => {
    mockHook({
      hasProviderConfiguration: true,
      providers: [
        { id: 'keycloak', label: 'Keycloak' },
        { id: 'entra', label: 'Microsoft Entra ID' },
      ],
      externalLoginStatus: OverlayExternalLoginStatus.Waiting,
    });

    render(<OverlayLoginGate />);

    const keycloakButton = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Keycloak',
    });
    expect(keycloakButton.disabled).toBe(false);

    fireEvent.click(keycloakButton);
    expect(openProviderLogin).toHaveBeenCalledWith('keycloak');
  });

  it('allows replacing a generic external login while it is waiting', () => {
    mockHook({
      externalLoginStatus: OverlayExternalLoginStatus.Waiting,
    });

    render(<OverlayLoginGate />);

    const loginButton = screen.getByRole<HTMLButtonElement>('button', {
      name: ButtonsI18nKeys.LogIn,
    });
    expect(loginButton.disabled).toBe(false);

    fireEvent.click(loginButton);
    expect(openLogin).toHaveBeenCalledOnce();
  });

  it('announces a blocked external login as an alert', () => {
    mockHook({
      externalLoginStatus: OverlayExternalLoginStatus.Blocked,
    });

    render(<OverlayLoginGate />);

    expect(screen.getByRole('alert').textContent).toBe(
      AuthI18nKeys.OverlayExternalLoginBlocked,
    );
  });

  it('announces a long-running attempt politely', () => {
    mockHook({
      externalLoginStatus: OverlayExternalLoginStatus.TakingLonger,
    });

    render(<OverlayLoginGate />);

    const message = screen.getByText(AuthI18nKeys.OverlayLoginTakingLonger);
    expect(message.getAttribute('aria-live')).toBe('polite');
  });
});
