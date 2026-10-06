import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUser } from '../../../context/auth/UserContext';
import { useOptionalOverlay } from '../../../context/overlay/OverlayContext';
import { logout } from '../../../server-api/auth.api';
import { AuthStatus } from '../../../types/auth-status';
import LogoutConfirmationModal from '../LogoutConfirmationModal';

const resetMock = vi.fn();
const replaceSpy = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../context/auth/UserContext', () => ({
  useUser: vi.fn(),
}));

vi.mock('../../../context/overlay/OverlayContext', () => ({
  useOptionalOverlay: vi.fn(),
}));

vi.mock('../../../server-api/auth.api', () => ({
  logout: vi.fn(),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  ConfirmationPopup: ({
    open,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

describe('LogoutConfirmationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUser).mockReturnValue({
      status: AuthStatus.Authenticated,
      user: null,
      refresh: vi.fn(),
      reset: resetMock,
    } as ReturnType<typeof useUser>);
    vi.mocked(useOptionalOverlay).mockReturnValue(undefined);
    vi.mocked(logout).mockResolvedValue(undefined);
    vi.stubGlobal('location', { replace: replaceSpy });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the current route after logout in overlay mode', async () => {
    vi.mocked(useOptionalOverlay).mockReturnValue({} as never);
    render(<LogoutConfirmationModal isOpen onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.logOut' }),
    );

    await vi.waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(resetMock).toHaveBeenCalledOnce();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  /*
   * A full document load picks up the current chunk hashes; a client-side
   * navigate would lazy-import a Login chunk a redeploy may have removed
   * ([#9254](https://github.com/epam/ai-dial-chat/issues/9254)).
   */
  it('loads the login page as a fresh document outside overlay mode', async () => {
    render(<LogoutConfirmationModal isOpen onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.logOut' }),
    );

    await vi.waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/login'));
    expect(logout).toHaveBeenCalledOnce();
    expect(resetMock).not.toHaveBeenCalled();
  });

  it('still loads the login page when the logout request fails', async () => {
    vi.mocked(logout).mockRejectedValue(new Error('network'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<LogoutConfirmationModal isOpen onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.logOut' }),
    );

    await vi.waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/login'));
  });
});
