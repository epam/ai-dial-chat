import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUser } from '../../../context/auth/UserContext';
import { useOptionalOverlay } from '../../../context/overlay/OverlayContext';
import { logout } from '../../../server-api/auth.api';
import { AuthStatus } from '../../../types/auth-status';
import LogoutConfirmationModal from '../LogoutConfirmationModal';

const navigateMock = vi.fn();
const resetMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
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
  DialConfirmationPopup: ({
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
  });

  it('keeps the current route after logout in overlay mode', async () => {
    vi.mocked(useOptionalOverlay).mockReturnValue({} as never);
    render(<LogoutConfirmationModal isOpen onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.logOut' }),
    );

    await vi.waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(resetMock).toHaveBeenCalledOnce();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('navigates to login after logout outside overlay mode', async () => {
    render(<LogoutConfirmationModal isOpen onClose={vi.fn()} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.logOut' }),
    );

    await vi.waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(resetMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });
});
