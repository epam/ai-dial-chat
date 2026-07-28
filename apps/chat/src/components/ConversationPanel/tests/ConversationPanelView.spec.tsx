import { OverlayFeature } from '@epam/ai-dial-chat-shared';
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
import { useConversationExport } from '../../../hooks/useConversationExport';
import { useConversationImport } from '../../../hooks/useConversationImport';
import { useUiFeature } from '../../../hooks/useUiFeature';
import { discardSharedCatalogItem } from '../../../server-api/share.api';
import {
  ConversationExportMode,
  ExportJobStatus,
} from '../../../types/conversation-export';
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
      onActionMenuOpen,
      className,
    }: {
      headerActions?: ReactNode;
      conversations?: Array<{ id: string }>;
      getActions?: (item: { id: string }) => Array<{
        key: string;
        label: ReactNode;
        onClick?: () => void;
        children?: Array<{
          key: string;
          label: ReactNode;
          onClick?: () => void;
        }>;
      }>;
      onActionMenuOpen?: (
        item: { id: string },
        trigger: HTMLButtonElement,
      ) => void;
      className?: string;
    }) => (
      <div role="region" aria-label="conversation panel" className={className}>
        {headerActions}
        {panelConversations?.map((item) => (
          <div key={item.id}>
            <button
              id={`action-trigger-${item.id}`}
              aria-label={`action trigger ${item.id}`}
            />
            {(getActions?.(item) ?? []).map((action) =>
              action.children ? (
                // Simulates the hover-revealed submenu: children render as sibling buttons.
                <div key={action.key}>
                  <span>{action.label}</span>
                  {action.children.map((child) => (
                    <button key={child.key} onClick={child.onClick}>
                      {child.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  key={action.key}
                  onClick={() => {
                    const trigger = document.getElementById(
                      `action-trigger-${item.id}`,
                    ) as HTMLButtonElement | null;
                    if (trigger) onActionMenuOpen?.(item, trigger);
                    action.onClick?.();
                  }}
                >
                  {action.label}
                </button>
              ),
            )}
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
  IconDownload: () => null,
  IconFileArrowLeft: () => null,
  IconFileArrowRight: () => null,
  IconPencilMinus: () => null,
  IconPin: () => null,
  IconPinnedFilled: () => null,
  IconShare: () => null,
  IconTrashX: () => null,
  IconWorldShare: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../context/ConversationsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../../server-api/share.api');
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => ({ items: [] }),
}));
vi.mock('../../../hooks/breakpoint/useBreakpoint', () => ({
  useIsMobile: () => false,
}));
vi.mock('../../../hooks/useUiFeature');
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
vi.mock(
  '../../PublishConversationPanelContainer/PublishConversationPanelContainer',
  () => ({
    default: ({
      conversationPath,
      conversationTitle,
      onClose,
      returnFocusRef,
    }: {
      conversationPath: string;
      conversationTitle: string;
      onClose: () => void;
      returnFocusRef?: { current: HTMLElement | null };
    }) => (
      <div role="dialog" aria-label="publish conversation">
        <span>{conversationPath}</span>
        <span>{conversationTitle}</span>
        <span>{returnFocusRef?.current?.getAttribute('aria-label')}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ),
  }),
);
vi.mock('../../ImportExportQueue/ImportExportQueue', () => ({
  default: ({
    title,
    jobs,
    onDismiss,
    onRetry,
  }: {
    title: string;
    jobs: Array<{ id: string; label: string; status: string }>;
    onClose: () => void;
    onDismiss: (jobId: string) => void;
    onRetry: (jobId: string) => void;
  }) => {
    if (jobs.length === 0) return null;
    return (
      <div role="status">
        <span>{title}</span>
        {jobs.map((job) => (
          <div key={job.id}>
            <span>{job.label}</span>
            {job.status === 'failed' && (
              <button onClick={() => onRetry(job.id)}>Retry</button>
            )}
            <button onClick={() => onDismiss(job.id)}>Close</button>
          </div>
        ))}
      </div>
    );
  },
}));
vi.mock('../../../hooks/useConversationExport');
vi.mock('../../../hooks/useConversationImport');
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
const PUBLISH_LABEL = 'buttons.publish';

const UNSHARE_CONFIRM_TITLE = 'conversationPanel.unshare.unshareConfirmTitle';
const UNSHARE_ERROR = 'conversationPanel.unshare.unshareError';

const mockDeleteAllConversations =
  vi.fn<() => Promise<ConversationDeletionResultDto>>();
const mockShowNotification = vi.fn();
const mockExportSingle = vi.fn().mockResolvedValue(undefined);
const mockExportAll = vi.fn().mockResolvedValue(undefined);
const mockDismissJob = vi.fn();
const mockRetryJob = vi.fn();
const mockImportConversations = vi.fn().mockResolvedValue(undefined);
const mockDismissImportJob = vi.fn();
const mockRetryImportJob = vi.fn();

const EXPORT_LABEL = 'conversationExport.exportLabel';
const EXPORT_ALL_LABEL = 'conversationExport.exportAllLabel';
const IMPORT_LABEL = 'conversationImport.importLabel';

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
  vi.mocked(useUiFeature).mockReturnValue(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useConversations).mockReturnValue(baseContextValue as any);
  vi.mocked(useNotification).mockReturnValue({
    notifications: [],
    showNotification: mockShowNotification,
    dismissNotification: vi.fn(),
  });
  vi.mocked(useConversationExport).mockReturnValue({
    jobs: [],
    exportSingle: mockExportSingle,
    exportAll: mockExportAll,
    dismissJob: mockDismissJob,
    retryJob: mockRetryJob,
    dismissAll: vi.fn(),
  });
  vi.mocked(useConversationImport).mockReturnValue({
    jobs: [],
    importConversations: mockImportConversations,
    dismissJob: mockDismissImportJob,
    retryJob: mockRetryImportJob,
    dismissAll: vi.fn(),
  });
});

describe('ConversationPanelView — delete-all header action', () => {
  it('renders the overflow trigger with the accessible label', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: PANEL_ACTIONS_LABEL }),
    ).toBeTruthy();
  });

  it('dropdown contains Export all conversations and Delete all conversations', () => {
    render(<ConversationPanelView {...defaultProps} />);
    openDropdown();
    expect(
      screen.getAllByRole('button', { name: DELETE_ALL_LABEL }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: EXPORT_ALL_LABEL }),
    ).toHaveLength(1);
  });

  it('clicking Export all conversations starts export-all without a modal', () => {
    render(<ConversationPanelView {...defaultProps} />);
    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: EXPORT_ALL_LABEL }));

    expect(mockExportAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('excludes Share from the menu when conversations-sharing is disabled', () => {
    vi.mocked(useUiFeature).mockImplementation(
      (feature) => feature !== OverlayFeature.ConversationsSharing,
    );
    render(<ConversationPanelView {...defaultProps} />);
    expect(screen.queryByRole('button', { name: SHARE_LABEL })).toBeNull();
  });
});

describe('ConversationPanelView — publish', () => {
  it('owned conversation menu includes Publish', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(screen.getByRole('button', { name: PUBLISH_LABEL })).toBeTruthy();
  });

  it('readonly (shared-with-me) conversation menu excludes Publish', () => {
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

    expect(screen.queryByRole('button', { name: PUBLISH_LABEL })).toBeNull();
  });

  it('published-with-me conversation menu excludes Publish', () => {
    const publishedConversation = {
      id: 'conv3',
      title: 'Published chat',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: false,
      publishedWithMe: true,
    };

    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [publishedConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(
      <ConversationPanelView {...defaultProps} activeConversationId="conv3" />,
    );

    expect(screen.queryByRole('button', { name: PUBLISH_LABEL })).toBeNull();
  });

  it('clicking Publish opens the panel for the conversation path and title', () => {
    render(<ConversationPanelView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: PUBLISH_LABEL }));

    const dialog = screen.getByRole('dialog', {
      name: 'publish conversation',
    });
    expect(within(dialog).getByText('conv1')).toBeTruthy();
    expect(within(dialog).getByText('action trigger conv1')).toBeTruthy();
  });

  it('closing the panel clears the pending publish state', async () => {
    render(<ConversationPanelView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: PUBLISH_LABEL }));
    const dialog = screen.getByRole('dialog', {
      name: 'publish conversation',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'publish conversation' }),
      ).toBeNull();
    });
  });

  it('excludes Publish from the menu when conversations-publishing is disabled', () => {
    vi.mocked(useUiFeature).mockImplementation(
      (feature) => feature !== OverlayFeature.ConversationsPublishing,
    );
    render(<ConversationPanelView {...defaultProps} />);
    expect(screen.queryByRole('button', { name: PUBLISH_LABEL })).toBeNull();
  });
});

describe('ConversationPanelView — export', () => {
  it('row action list contains an Export item (submenu trigger, no onClick of its own)', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(screen.getByText(EXPORT_LABEL)).toBeTruthy();
  });

  it('the Export submenu offers "with attachments" and "without attachments" — no modal', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.getByRole('button', {
        name: 'conversationExport.withAttachmentsOption',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'conversationExport.withoutAttachmentsOption',
      }),
    ).toBeTruthy();
    expect(mockExportSingle).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('choosing "with attachments" calls exportSingle with the conversation id, title, and mode', () => {
    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'conversationExport.withAttachmentsOption',
      }),
    );

    expect(mockExportSingle).toHaveBeenCalledWith(
      'conv1',
      'Chat 1',
      ConversationExportMode.WithAttachments,
    );
  });

  it('choosing "without attachments" calls exportSingle with the conversation id, title, and mode', () => {
    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'conversationExport.withoutAttachmentsOption',
      }),
    );

    expect(mockExportSingle).toHaveBeenCalledWith(
      'conv1',
      'Chat 1',
      ConversationExportMode.WithoutAttachments,
    );
  });

  it('shows the non-modal export queue while jobs are present', () => {
    vi.mocked(useConversationExport).mockReturnValue({
      jobs: [
        {
          id: 'job-1',
          label: 'Chat 1',
          status: ExportJobStatus.InProgress,
        },
      ],
      exportSingle: mockExportSingle,
      exportAll: mockExportAll,
      dismissJob: mockDismissJob,
      retryJob: mockRetryJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Chat 1')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides the export queue when there are no jobs', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('clicking close on a queue job calls dismissJob with its id', () => {
    vi.mocked(useConversationExport).mockReturnValue({
      jobs: [
        { id: 'job-2', label: 'Chat 2', status: ExportJobStatus.InProgress },
      ],
      exportSingle: mockExportSingle,
      exportAll: mockExportAll,
      dismissJob: mockDismissJob,
      retryJob: mockRetryJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(mockDismissJob).toHaveBeenCalledWith('job-2');
  });

  it('clicking retry on a failed queue job calls retryJob with its id', () => {
    vi.mocked(useConversationExport).mockReturnValue({
      jobs: [{ id: 'job-3', label: 'Chat 3', status: ExportJobStatus.Failed }],
      exportSingle: mockExportSingle,
      exportAll: mockExportAll,
      dismissJob: mockDismissJob,
      retryJob: mockRetryJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockRetryJob).toHaveBeenCalledWith('job-3');
  });
});

describe('ConversationPanelView — import header action', () => {
  it('dropdown contains an Import item positioned after Export all', () => {
    render(<ConversationPanelView {...defaultProps} />);
    openDropdown();
    expect(screen.getAllByRole('button', { name: IMPORT_LABEL })).toHaveLength(
      1,
    );
  });

  it('clicking Import triggers the hidden file input', () => {
    render(<ConversationPanelView {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: IMPORT_LABEL }));

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('accepts .json, .dial, and .zip files', () => {
    render(<ConversationPanelView {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput.accept).toBe('.json,.dial,.zip');
  });

  it('selecting a file calls importConversations with that file', () => {
    render(<ConversationPanelView {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['{}'], 'export.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockImportConversations).toHaveBeenCalledWith(file);
  });

  it('resets the file input value after selection so the same file can be re-picked', () => {
    render(<ConversationPanelView {...defaultProps} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['{}'], 'export.json');

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(fileInput.value).toBe('');
  });
});

describe('ConversationPanelView — separate import/export transfer queues', () => {
  it('shows an import job in its own non-modal queue', () => {
    vi.mocked(useConversationImport).mockReturnValue({
      jobs: [
        {
          id: 'imp-1',
          label: 'Imported Chat',
          status: ExportJobStatus.InProgress,
        },
      ],
      importConversations: mockImportConversations,
      dismissJob: mockDismissImportJob,
      retryJob: mockRetryImportJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Imported Chat')).toBeTruthy();
  });

  it('renders two separate queues with their own titles when both import and export jobs are present', () => {
    vi.mocked(useConversationExport).mockReturnValue({
      jobs: [
        { id: 'job-1', label: 'Chat 1', status: ExportJobStatus.InProgress },
      ],
      exportSingle: mockExportSingle,
      exportAll: mockExportAll,
      dismissJob: mockDismissJob,
      retryJob: mockRetryJob,
      dismissAll: vi.fn(),
    });
    vi.mocked(useConversationImport).mockReturnValue({
      jobs: [
        {
          id: 'imp-1',
          label: 'Imported Chat',
          status: ExportJobStatus.InProgress,
        },
      ],
      importConversations: mockImportConversations,
      dismissJob: mockDismissImportJob,
      retryJob: mockRetryImportJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);

    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByText('conversationExport.queueTitle')).toBeTruthy();
    expect(screen.getByText('conversationImport.queueTitle')).toBeTruthy();
  });

  it('shows the Importing title when only import jobs are present', () => {
    vi.mocked(useConversationImport).mockReturnValue({
      jobs: [
        {
          id: 'imp-1',
          label: 'Imported Chat',
          status: ExportJobStatus.InProgress,
        },
      ],
      importConversations: mockImportConversations,
      dismissJob: mockDismissImportJob,
      retryJob: mockRetryImportJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);

    expect(screen.getByText('conversationImport.queueTitle')).toBeTruthy();
  });

  it('shows the Exporting title when only export jobs are present', () => {
    vi.mocked(useConversationExport).mockReturnValue({
      jobs: [
        { id: 'job-1', label: 'Chat 1', status: ExportJobStatus.InProgress },
      ],
      exportSingle: mockExportSingle,
      exportAll: mockExportAll,
      dismissJob: mockDismissJob,
      retryJob: mockRetryJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);

    expect(screen.getByText('conversationExport.queueTitle')).toBeTruthy();
  });

  it('wires the import queue dismiss button to the import hook', () => {
    vi.mocked(useConversationImport).mockReturnValue({
      jobs: [
        {
          id: 'imp-1',
          label: 'Imported Chat',
          status: ExportJobStatus.InProgress,
        },
      ],
      importConversations: mockImportConversations,
      dismissJob: mockDismissImportJob,
      retryJob: mockRetryImportJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(mockDismissImportJob).toHaveBeenCalledWith('imp-1');
    expect(mockDismissJob).not.toHaveBeenCalled();
  });

  it('wires the import queue retry button to the import hook', () => {
    vi.mocked(useConversationImport).mockReturnValue({
      jobs: [
        { id: 'imp-1', label: 'Imported Chat', status: ExportJobStatus.Failed },
      ],
      importConversations: mockImportConversations,
      dismissJob: mockDismissImportJob,
      retryJob: mockRetryImportJob,
      dismissAll: vi.fn(),
    });

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(mockRetryImportJob).toHaveBeenCalledWith('imp-1');
    expect(mockRetryJob).not.toHaveBeenCalled();
  });
});

describe('ConversationPanelView — unshare (shared-with-me delete)', () => {
  const sharedConversation = {
    id: 'conv1',
    title: 'Shared chat',
    isPinned: false,
    updatedAt: 0,
    sharedWithMe: true,
    publishedWithMe: false,
  };

  beforeEach(() => {
    vi.mocked(discardSharedCatalogItem).mockResolvedValue({ success: true });
  });

  it('shared-with-me row menu includes Delete', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    ).toBeTruthy();
  });

  it('owned row menu renders exactly one Delete action (the owner-delete, not an extra unshare one)', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.getAllByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    ).toHaveLength(1);
  });

  it('published-with-me (not shared-with-me) row menu does not include Delete', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [
        { ...sharedConversation, sharedWithMe: false, publishedWithMe: true },
      ],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.queryByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    ).toBeNull();
  });

  it('clicking Delete opens confirmation without calling the discard API', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(
      screen.getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(UNSHARE_CONFIRM_TITLE)).toBeTruthy();
    expect(discardSharedCatalogItem).not.toHaveBeenCalled();
  });

  it('confirm calls discardSharedCatalogItem exactly once and disables the button while pending', async () => {
    let resolveDiscard: (value: { success: boolean }) => void = () => undefined;
    vi.mocked(discardSharedCatalogItem).mockReturnValue(
      new Promise((resolve) => {
        resolveDiscard = resolve;
      }),
    );
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(
      screen.getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    );
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', {
      name: DELETE_CONFIRM_BUTTON,
    });

    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(discardSharedCatalogItem).toHaveBeenCalledOnce();
    expect(discardSharedCatalogItem).toHaveBeenCalledWith('conv1');
    expect(confirmButton.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      resolveDiscard({ success: true });
    });
  });

  it('successful discard of a non-active conversation refreshes and notifies without navigating', async () => {
    const otherConversation = {
      id: 'other',
      title: 'Other chat',
      isPinned: false,
      updatedAt: 0,
      sharedWithMe: false,
      publishedWithMe: false,
    };
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation, otherConversation],
      refreshConversations: mockRefresh,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(
      <ConversationPanelView {...defaultProps} activeConversationId="other" />,
    );
    mockRefresh.mockClear();

    /* sharedConversation is listed first, so its unshare-Delete button is the first match. */
    fireEvent.click(
      screen.getAllByRole('button', { name: DELETE_CONFIRM_BUTTON })[0],
    );
    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
      );
    });

    expect(discardSharedCatalogItem).toHaveBeenCalledWith('conv1');
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledOnce();
    });
    expect(mockShowNotification).toHaveBeenCalledOnce();
    expect(mockNavigate).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('successful discard of the active conversation navigates to root', async () => {
    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
      refreshConversations: mockRefresh,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(
      <ConversationPanelView {...defaultProps} activeConversationId="conv1" />,
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

  it('a refreshConversations rejection after a successful discard still shows success, not an error', async () => {
    const mockRefresh = vi.fn().mockRejectedValue(new Error('refresh failed'));
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
      refreshConversations: mockRefresh,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

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
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(mockShowNotification).toHaveBeenCalledOnce();
  });

  it('failed discard keeps the popup open with an inline error and does not refresh or navigate', async () => {
    vi.mocked(discardSharedCatalogItem).mockRejectedValue(new Error('403'));
    const mockRefresh = vi.fn();
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
      refreshConversations: mockRefresh,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

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

    expect(within(dialog).getByText(UNSHARE_ERROR)).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('cancel closes the popup without calling the discard API', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...baseContextValue,
      conversations: [sharedConversation],
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    render(<ConversationPanelView {...defaultProps} />);
    fireEvent.click(
      screen.getByRole('button', { name: DELETE_CONFIRM_BUTTON }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: CANCEL_BUTTON }),
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(discardSharedCatalogItem).not.toHaveBeenCalled();
  });
});

describe('ConversationPanelView — UI feature gates', () => {
  it('does not render the panel when conversations-section is disabled', () => {
    vi.mocked(useUiFeature).mockImplementation(
      (feature) => feature !== OverlayFeature.ConversationsSection,
    );
    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.queryByRole('region', { name: 'conversation panel' }),
    ).toBeNull();
  });

  it('renders the panel when conversations-section is enabled', () => {
    render(<ConversationPanelView {...defaultProps} />);
    expect(
      screen.getByRole('region', { name: 'conversation panel' }),
    ).toBeTruthy();
  });
});
