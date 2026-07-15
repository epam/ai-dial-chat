import {
  ConversationDeletionFailureDtoCodeEnum,
  type ConversationDeletionResultDto,
} from '@epam/chat-api-client';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { cloneElement, ReactElement, ReactNode, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversations } from '../../../context/ConversationsContext';
import { useNotification } from '../../../context/NotificationContext';
import ConversationPanelView from '../ConversationPanelView';

vi.mock('@epam/ai-dial-conversation-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-conversation-panel')>();
  return {
    ...actual,
    ConversationPanel: ({
      headerActions,
      conversations: panelConversations,
      getActions,
    }: {
      headerActions?: ReactNode;
      conversations?: Array<{ id: string }>;
      getActions?: (item: { id: string }) => Array<{
        key: string;
        label: ReactNode;
        onClick?: () => void;
      }>;
    }) => (
      <div role="region" aria-label="conversation panel">
        {headerActions}
        {panelConversations?.map((item) => (
          <div key={item.id}>
            {(getActions?.(item) ?? []).map((action) => (
              <button key={action.key} onClick={action.onClick}>
                {action.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    ),
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
      description?: ReactNode;
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
      children: ReactElement<{ onClick?: () => void }>;
      items: Array<{
        key: string;
        label: ReactNode;
        onClick: () => void;
      }>;
    }) => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          {cloneElement(children, {
            onClick: () => setIsOpen((value) => !value),
          })}
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
      icon?: ReactNode;
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
    DialPopup: ({
      open,
      children,
    }: {
      open: boolean;
      children?: ReactNode;
    }) => {
      if (!open) return null;
      return <div role="dialog">{children}</div>;
    },
  };
});

vi.mock('@tabler/icons-react', () => ({
  IconCopy: () => null,
  IconDotsVertical: () => null,
  IconPencilMinus: () => null,
  IconPin: () => null,
  IconPinnedFilled: () => null,
  IconShare: () => null,
  IconTrashX: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../context/ConversationsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({ items: [] }),
}));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));
vi.mock('../../../constants/routes', () => ({
  getConversationRoute: (id: string) => `/conversations/${id}`,
  normalizeConversationId: (id: string) => id,
}));
vi.mock('../../../utils/get-model-id-from-conversation-id', () => ({
  getModelIdFromConversationId: () => undefined,
}));
vi.mock('../../../utils/icon-path', () => ({
  resolveCatalogIconUrl: (url: string) => url,
}));
vi.mock('../../RenameConversationPopup/RenameConversationPopup', () => ({
  default: ({
    isOpen,
    currentTitle,
    error,
    onSave,
    onCancel,
  }: {
    isOpen: boolean;
    currentTitle: string;
    isSaving: boolean;
    error: string | null;
    onSave: (newTitle: string) => void;
    onCancel: () => void;
  }) => {
    if (!isOpen) return null;
    return (
      <div role="dialog" aria-label="rename conversation">
        <span>{currentTitle}</span>
        {error && <span role="alert">{error}</span>}
        <button onClick={() => onSave('New Title')}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));
vi.mock('../get-conversation-source', () => ({
  getConversationSource: () => undefined,
}));
vi.mock(
  '../../ShareConversationPopoverContainer/ShareConversationPopoverContainer',
  () => ({
    default: ({
      conversationPath,
      onClose,
    }: {
      conversationPath: string;
      onClose: () => void;
    }) => (
      <div aria-label="share conversation">
        <span>{conversationPath}</span>
        <button onClick={onClose}>Close share</button>
      </div>
    ),
  }),
);

const mockNavigate = vi.fn();

const PANEL_ACTIONS_LABEL = 'conversationPanel.panelActionsLabel';
const DELETE_ALL_LABEL = 'conversationPanel.deleteAll.deleteAllChatsLabel';
const CONFIRM_TITLE = 'conversationPanel.deleteAll.deleteAllConfirmTitle';
const CONFIRM_BUTTON = 'buttons.deleteAll';
const CANCEL_BUTTON = 'buttons.cancel';
const DELETE_ALL_ERROR = 'conversationPanel.deleteAll.deleteAllError';
const PARTIAL_ERROR = 'conversationPanel.deleteAll.deleteAllPartialError';

const DELETE_CONFIRM_BUTTON = 'buttons.delete';
const SHARE_LABEL = 'share.title';

const mockDeleteAllConversations =
  vi.fn<() => Promise<ConversationDeletionResultDto>>();
const mockShowNotification = vi.fn();

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
  vi.mocked(useNotification).mockReturnValue({
    notifications: [],
    showNotification: mockShowNotification,
    dismissNotification: vi.fn(),
  });
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

    /*
     * Use empty conversations list to guard against stale-closure regression:
     * navigation must not depend on finding the active conversation in the list.
     */
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

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
      failed: [
        {
          id: 'conv1',
          code: ConversationDeletionFailureDtoCodeEnum.UpstreamError,
        },
      ],
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

  it('partial failure: popup closes, global notification shown, navigate called', async () => {
    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 2,
      deleted: 1,
      alreadyAbsent: 0,
      failed: [
        {
          id: 'conv1',
          code: ConversationDeletionFailureDtoCodeEnum.UpstreamError,
        },
      ],
    });

    render(<ConversationPanelView {...defaultProps} />);
    openDeleteAllPopup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockShowNotification).toHaveBeenCalledWith({
      variant: 'error',
      message: PARTIAL_ERROR,
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
    let resolveDelete:
      | ((result: ConversationDeletionResultDto) => void)
      | undefined;
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
      resolveDelete?.({
        requested: 1,
        deleted: 1,
        alreadyAbsent: 0,
        failed: [],
      });
    });
  });

  it('shows a success notification for complete success', async () => {
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
    expect(mockShowNotification).toHaveBeenCalledWith({
      variant: 'success',
      title: 'conversationPanel.deleteAll.deleteAllSuccessTitle',
      message: 'conversationPanel.deleteAll.deleteAllSuccess',
    });
  });

  it('cancel is a no-op while deletion is in progress', async () => {
    let resolveDelete:
      | ((result: ConversationDeletionResultDto) => void)
      | undefined;
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
      resolveDelete?.({
        requested: 1,
        deleted: 1,
        alreadyAbsent: 0,
        failed: [],
      });
    });
  });

  it('complete success: navigates to root even when conversations list is empty at callback time', async () => {
    mockDeleteAllConversations.mockResolvedValueOnce({
      requested: 0,
      deleted: 0,
      alreadyAbsent: 0,
      failed: [],
    });

    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

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
});

describe('ConversationPanelView — single-conversation delete navigation', () => {
  it('navigates to root after deleting the active conversation', async () => {
    render(<ConversationPanelView {...defaultProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    );

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('does not navigate when deleting a non-active conversation', async () => {
    const secondConversation = {
      id: 'conv2',
      title: 'Chat 2',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: false,
      publishedWithMe: false,
    };

    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [baseContextValue.conversations[0], secondConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(
      <ConversationPanelView {...defaultProps} activeConversationId="conv1" />,
    );

    const deleteButtons = screen.getAllByRole('button', {
      name: DELETE_CONFIRM_BUTTON,
    });
    fireEvent.click(deleteButtons[1]);

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to root when ID comparison requires decodeURIComponent', async () => {
    /*
     * Simulates a conversation whose title contains a space stored as %20 in the API id.
     * getConversationRoute double-encodes to %2520; app.tsx decodes once back to %20.
     * So activeConversationId still contains %20, not a literal space.
     */
    const encodedConversation = {
      id: 'conversations/bucket/gpt-4__My%20Chat.json',
      title: 'My Chat',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: false,
      publishedWithMe: false,
    };

    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [encodedConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(
      <ConversationPanelView
        {...defaultProps}
        activeConversationId="conversations/bucket/gpt-4__My%20Chat.json"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    );

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
      );
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});

describe('ConversationPanelView — rename', () => {
  const RENAME_LABEL = 'buttons.rename';

  it('clicking rename opens the popup with the current title', () => {
    render(<ConversationPanelView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: RENAME_LABEL }));

    const dialog = screen.getByRole('dialog', {
      name: 'rename conversation',
    });
    expect(within(dialog).getByText('Chat 1')).toBeTruthy();
  });

  it('confirming rename does not navigate', async () => {
    const mockRenameConversation = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      renameConversation: mockRenameConversation,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: RENAME_LABEL }));

    const dialog = screen.getByRole('dialog', {
      name: 'rename conversation',
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    });

    expect(mockRenameConversation).toHaveBeenCalledWith('conv1', 'New Title');
    expect(mockNavigate).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

describe('ConversationPanelView — share', () => {
  it('owned conversation menu includes Share', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(screen.getByRole('button', { name: SHARE_LABEL })).toBeTruthy();
  });

  it('readonly (shared-with-me) conversation menu excludes Share', () => {
    const sharedConversation = {
      id: 'conv2',
      title: 'Shared chat',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: true,
      publishedWithMe: false,
    };

    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(
      <ConversationPanelView {...defaultProps} activeConversationId="conv2" />,
    );

    expect(screen.queryByRole('button', { name: SHARE_LABEL })).toBeNull();
  });

  it('clicking Share opens the popover for the conversation path', () => {
    render(<ConversationPanelView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: SHARE_LABEL }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('conv1')).toBeTruthy();
  });

  it('closing the popover clears the pending share state', async () => {
    render(<ConversationPanelView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: SHARE_LABEL }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close share' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
