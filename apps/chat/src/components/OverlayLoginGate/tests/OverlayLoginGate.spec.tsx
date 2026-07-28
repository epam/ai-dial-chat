import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
} from '../../../constants/translation-keys';
import {
  OverlayExternalLoginStatus,
  useOverlayExternalLogin,
} from '../../../hooks/auth/useOverlayExternalLogin';
import OverlayLoginGate from '../OverlayLoginGate';

vi.mock('../../../hooks/auth/useOverlayExternalLogin', () => ({
  OverlayExternalLoginStatus: {
    Idle: 'idle',
    Opening: 'opening',
    Waiting: 'waiting',
    Blocked: 'blocked',
    TakingLonger: 'takingLonger',
  },
  useOverlayExternalLogin: vi.fn(),
}));

describe('OverlayLoginGate', () => {
  const openLoginSpy = vi.fn();
  const mockUseOverlayExternalLogin = vi.mocked(useOverlayExternalLogin);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOverlayExternalLogin.mockReturnValue({
      status: OverlayExternalLoginStatus.Idle,
      openLogin: openLoginSpy,
    });
  });

  it('renders the localized gate content and login action', () => {
    render(<OverlayLoginGate />);

    expect(screen.getByText(AuthI18nKeys.OverlayLoginTitle)).toBeTruthy();
    expect(screen.getByText(AuthI18nKeys.OverlayLoginDescription)).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('calls openLogin when the login action is clicked', () => {
    render(<OverlayLoginGate />);

    fireEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.LogIn }),
    );

    expect(openLoginSpy).toHaveBeenCalledOnce();
  });

  it.each([
    OverlayExternalLoginStatus.Opening,
    OverlayExternalLoginStatus.Waiting,
  ])(
    'disables the login action while the external login state is %s',
    (status) => {
      mockUseOverlayExternalLogin.mockReturnValue({
        status,
        openLogin: openLoginSpy,
      });

      const { container } = render(<OverlayLoginGate />);

      expect(
        container.querySelector('section')?.getAttribute('aria-busy'),
      ).toBe('true');
      expect(
        (
          screen.getByRole('button', {
            name: ButtonsI18nKeys.LogIn,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    },
  );

  it('announces a blocked external login window as an alert and keeps retry enabled', () => {
    mockUseOverlayExternalLogin.mockReturnValue({
      status: OverlayExternalLoginStatus.Blocked,
      openLogin: openLoginSpy,
    });

    render(<OverlayLoginGate />);

    expect(screen.getByRole('alert').textContent).toBe(
      AuthI18nKeys.OverlayExternalLoginBlocked,
    );
    expect(
      (
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('announces a long-running attempt politely and keeps retry enabled', () => {
    mockUseOverlayExternalLogin.mockReturnValue({
      status: OverlayExternalLoginStatus.TakingLonger,
      openLogin: openLoginSpy,
    });

    const { container } = render(<OverlayLoginGate />);

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe(AuthI18nKeys.OverlayLoginTakingLonger);
    expect(
      (
        screen.getByRole('button', {
          name: ButtonsI18nKeys.LogIn,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
