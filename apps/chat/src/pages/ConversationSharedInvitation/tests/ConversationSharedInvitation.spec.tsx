import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptInvitation } from '../../../server-api/share.api';
import { ROUTES } from '../../../types/routes';
import ConversationSharedInvitationPage from '../ConversationSharedInvitation';

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
  useNotification: () => ({
    notifications: [],
    showNotification: vi.fn(),
    dismissNotification: vi.fn(),
  }),
}));

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({
    items: [],
    selectedItemId: null,
    setSelectedItemId: vi.fn(),
    restoreSelectedItemId: vi.fn(),
    selectedDeploymentConfiguration: null,
    isLoading: false,
    error: null,
    schemas: [],
    toolsets: [],
    refetchToolsets: vi.fn().mockResolvedValue(undefined),
    refetchDeployments: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../../server-api/share.api', () => ({
  acceptInvitation: vi.fn(),
}));

describe('ConversationSharedInvitationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvitationId = 'abc123';
  });

  it('accepts the invitation and redirects into the conversation route', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      itemId: 'conversations/bucket/my-chat.json',
    });

    render(<ConversationSharedInvitationPage />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/conversations/bucket/my-chat.json',
        { replace: true },
      ),
    );
  });

  it('falls back to the root route when accepting the invitation fails', async () => {
    vi.mocked(acceptInvitation).mockRejectedValue(new Error('not found'));

    render(<ConversationSharedInvitationPage />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.Root, {
        replace: true,
      }),
    );
  });
});
