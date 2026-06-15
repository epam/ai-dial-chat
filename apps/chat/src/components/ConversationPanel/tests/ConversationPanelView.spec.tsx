import type { ConversationDeletionResultDto } from '@epam/chat-api-client';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversations } from '../../../context/ConversationsContext';
import ConversationPanelView from '../ConversationPanelView';

vi.mock('@epam/ai-dial-conversation-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-conversation-panel')>();
  return {
    ...actual,
    ConversationPanel: ({
      headerActions,
    }: {
      headerActions?: React.ReactNode;
    }) => <div data-testid="conversation-panel">{headerActions}</div>,
  };
});

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialConfirmationPopup: ({
      open,
      header,
      confirmLabel,
      cancelLabel,
      description,
      onConfirm,
      onCancel,
      isLoading,
      disableConfirmButton,
    }: {
      open: boolean;
      header: string;
      confirmLabel: string;
      cancelLabel: string;
      description?: React.ReactNode;
      onConfirm: () => void;
      onCancel: () => void;
      isLoading?: boolean;
      disableConfirmButton?: boolean;
    }) => {
      if (!open) return null;
      return (
        <div role="dialog">
          <h2>{header}</h2>
          <div>{description}</div>
          <button
            disabled={!!disableConfirmButton || !!isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button onClick={onCancel}>{cancelLabel}</button>
        </div>
      );
    },
    DialDropdown: ({
      children,
      items,
    }: {
      children: React.ReactNode;
      items: Array<{
        key: string;
        label: React.ReactNode;
        onClick: () => void;
      }>;
    }) => {
      const [isOpen, setIsOpen] = React.useState(false);
      return (
        <div>
          <div onClick={() => setIsOpen((v) => !v)}>{children}</div>
          {isOpen &&
            items.map((item) => (
              <button key={item.key} onClick={item.onClick}>
                {item.label}
              </button>
            ))}
        </div>
      );
    },
    DialIconButton: ({
      'aria-label': ariaLabel,
      onClick,
      icon,
    }: {
      'aria-label': string;
      onClick?: () => void;
      icon?: React.ReactNode;
    }) => (
      <button aria-label={ariaLabel} onClick={onClick}>
        {icon}
      </button>
    ),
    DialNotification: ({
      message,
      onClose,
      closable,
    }: {
      message: string;
      onClose?: () => void;
      closable?: boolean;
    }) => (
      <div role="alert">
        {message}
        {closable && <button onClick={onClose}>Close notification</button>}
      </div>
    ),
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconCopy: () => null,
  IconDotsVertical: () => null,
  IconPencilMinus: () => null,
  IconPin: () => null,
  IconPinnedFilled: () => null,
  IconTrashX: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../context/ConversationsContext');
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({ items: [] }),
}));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));
vi.mock('../../../hooks/use-viewport-width', () => ({
  default: () => 1440,
}));
vi.mock('../../../hooks/useLocalStorage', () => ({
  default: () => [325, vi.fn()],
}));
vi.mock('../../../constants/routes', () => ({
  ROUTES: { ROOT: '/' },
  getConversationRoute: (id: string) => `/conversations/${id}`,
  normalizeConversationId: (id: string) => id,
}));
vi.mock('../../../constants/storage', () => ({
  StorageKey: { ConversationPanelWidth: 'dial:cpw' },
}));
vi.mock('../../../utils/get-model-id-from-conversation-id', () => ({
  getModelIdFromConversationId: () => undefined,
}));
vi.mock('../../../utils/icon-path', () => ({
  resolveCatalogIconUrl: (url: string) => url,
}));
vi.mock('../../RenameConversationPopup/RenameConversationPopup', () => ({
  default: () => null,
}));
vi.mock('../get-conversation-source', () => ({
  getConversationSource: () => undefined,
}));

const mockNavigate = vi.fn();

const PANEL_ACTIONS_LABEL = 'conversationPanel.panelActionsLabel';
const DELETE_ALL_LABEL = 'conversationPanel.deleteAllChatsLabel';
const CONFIRM_TITLE = 'conversationPanel.deleteAllConfirmTitle';
const CONFIRM_BUTTON = 'conversationPanel.deleteAllConfirmButton';
const CANCEL_BUTTON = 'buttons.cancel';
const DELETE_ALL_ERROR = 'conversationPanel.deleteAllError';
const PARTIAL_ERROR = 'conversationPanel.deleteAllPartialError';

const mockDeleteAllConversations =
  vi.fn<() => Promise<ConversationDeletionResultDto>>();

const baseContextValue = {
  conversations: [
    {
      id: 'conv1',
      title: 'Chat 1',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: false,
      publishedWithMe: false,
    },
  ],
  isLoading: false,
  error: null,
  pinConversation: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  duplicateConversation: vi.fn(),
  refreshConversations: vi.fn(),
  deleteAllConversations: mockDeleteAllConversations,
};

const defaultProps = {
  isOpen: true,
  activeConversationId: 'conv1',
  onClose: vi.fn(),
  onSelectConversation: vi.fn(),
  onNewChat: vi.fn(),
};

const openDropdown = () => {
  fireEvent.click(screen.getByRole('button', { name: PANEL_ACTIONS_LABEL }));
};

const openDeleteAllPopup = () => {
  openDropdown();
  fireEvent.click(screen.getByRole('button', { name: DELETE_ALL_LABEL }));
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useConversations).mockReturnValue(baseContextValue as any);
});

describe('ConversationPanelView — delete-all header action', () => {
  it('renders the overflow trigger with the accessible label', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: PANEL_ACTIONS_LABEL }),
    ).toBeTruthy();
  });

  it('dropdown contains exactly one item: Delete all conversations', () => {
    render(<ConversationPanelView {...defaultProps} />);
    openDropdown();
    const items = screen.getAllByRole('button', { name: DELETE_ALL_LABEL });
    expect(items).toHaveLength(1);
  });

  it('clicking the item opens the confirmation popup without calling the API', () => {
    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(CONFIRM_TITLE)).toBeTruthy();
    expect(mockDeleteAllConversations).not.toHaveBeenCalled();
  });

  it('cancelling the popup closes it without calling the API', async () => {
    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    fireEvent.click(screen.getByRole('button', { name: CANCEL_BUTTON }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockDeleteAllConversations).not.toHaveBeenCalled();
  });

  it('complete success: closes popup and navigates to root when activeConversationId is set', async () => {
    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 1,
      deleted: 1,
      alreadyAbsent: 0,
      failed: [],
    });

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('complete success with no active conversation: does not navigate', async () => {
    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 1,
      deleted: 1,
      alreadyAbsent: 0,
      failed: [],
    });

    render(
      <ConversationPanelView
        {...defaultProps}
        activeConversationId={undefined}
      />,
    );
    openDeleteAllPopup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('total failure: popup stays open with inline error; navigate not called', async () => {
    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 1,
      deleted: 0,
      alreadyAbsent: 0,
      failed: [{ id: 'conv1', code: 'UPSTREAM_ERROR' }],
    });

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText(DELETE_ALL_ERROR)).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('partial failure: popup closes, notification shown, navigate called', async () => {
    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 2,
      deleted: 1,
      alreadyAbsent: 0,
      failed: [{ id: 'conv1', code: 'UPSTREAM_ERROR' }],
    });

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(PARTIAL_ERROR)).toBeTruthy();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('thrown error: popup stays open with inline error', async () => {
    mockDeleteAllConversations.mockRejectedValueOnce(
      new Error('Network failure'),
    );

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText(DELETE_ALL_ERROR)).toBeTruthy();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('confirm button is disabled during in-flight request', async () => {
    let resolveDelete: (result: ConversationDeletionResultDto) => void;
    const pendingPromise = new Promise<ConversationDeletionResultDto>(
      (resolve) => {
        resolveDelete = resolve;
      },
    );
    mockDeleteAllConversations.mockReturnValueOnce(pendingPromise);

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: CONFIRM_BUTTON });
      expect(btn.hasAttribute('disabled')).toBe(true);
    });

    await act(async () => {
      resolveDelete!({
        requested: 1,
        deleted: 1,
        alreadyAbsent: 0,
        failed: [],
      });
    });
  });

  it('partial-error notification is dismissable', async () => {
    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 2,
      deleted: 1,
      alreadyAbsent: 0,
      failed: [{ id: 'conv1', code: 'UPSTREAM_ERROR' }],
    });

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close notification' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('cancel is a no-op while deletion is in progress', async () => {
    let resolveDelete: (result: ConversationDeletionResultDto) => void;
    const pendingPromise = new Promise<ConversationDeletionResultDto>(
      (resolve) => {
        resolveDelete = resolve;
      },
    );
    mockDeleteAllConversations.mockReturnValueOnce(pendingPromise);

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: CONFIRM_BUTTON });
      expect(btn.hasAttribute('disabled')).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: CANCEL_BUTTON }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mockDeleteAllConversations).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete!({
        requested: 1,
        deleted: 1,
        alreadyAbsent: 0,
        failed: [],
      });
    });
  });
});
