import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareI18nKeys } from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { acceptInvitation } from '../../../server-api/share.api';
import { ROUTES } from '../../../types/routes';
import SharedInvitationPage from '../SharedInvitation';

const mockNavigate = vi.fn();
let mockInvitationId: string | undefined = 'abc123';

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ invitationId: mockInvitationId }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: vi.fn(),
}));

vi.mock('../../../server-api/share.api', () => ({
  acceptInvitation: vi.fn(),
}));

describe('SharedInvitationPage', () => {
  const showNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvitationId = 'abc123';
    vi.mocked(useNotification).mockReturnValue({
      notifications: [],
      showNotification,
      dismissNotification: vi.fn(),
    });
  });

  it('accepts the invitation and redirects to the catalog with the shared item selected', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({ itemId: 'gpt-4o' });

    render(<SharedInvitationPage />);

    await waitFor(() =>
      expect(acceptInvitation).toHaveBeenCalledWith('abc123'),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      `${ROUTES.Catalog}?itemId=gpt-4o`,
      { replace: true },
    );
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('shows an error notification and redirects to the catalog when the invitation is invalid', async () => {
    vi.mocked(acceptInvitation).mockRejectedValue(new Error('not found'));

    render(<SharedInvitationPage />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Catalog, {
        replace: true,
      }),
    );
    expect(showNotification).toHaveBeenCalledWith({
      variant: NotificationVariant.Error,
      message: 'not found',
    });
  });

  it('falls back to a generic error message when the error has no message', async () => {
    vi.mocked(acceptInvitation).mockRejectedValue({});

    render(<SharedInvitationPage />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Catalog, {
        replace: true,
      }),
    );
    expect(showNotification).toHaveBeenCalledWith({
      variant: NotificationVariant.Error,
      message: ShareI18nKeys.InvitationAcceptError,
    });
  });

  it('does not call acceptInvitation when invitationId is missing', () => {
    mockInvitationId = undefined;

    render(<SharedInvitationPage />);

    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('renders the route fallback spinner', () => {
    vi.mocked(acceptInvitation).mockResolvedValue({ itemId: 'gpt-4o' });

    render(<SharedInvitationPage />);

    expect(screen.getByRole('status')).toBeTruthy();
  });
});
