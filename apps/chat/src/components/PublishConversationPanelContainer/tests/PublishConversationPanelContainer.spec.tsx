import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from '../../../context/NotificationContext';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import {
  getConversationPublishHistory,
  publishConversation,
} from '../../../server-api/conversation-publish.api';
import PublishConversationPanelContainer from '../PublishConversationPanelContainer';

vi.mock('@epam/ai-dial-catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-catalog')>();
  return {
    ...actual,
    StandalonePublishPanel: ({
      resource,
      selectedFolderPath,
      onSelectedFolderPathChange,
      onCreateFolder,
      hasExistingPublicationInFolder,
      hasWriteAccess,
      isSubmitting,
      hasSubmitError,
      onClose,
      onSubmit,
    }: {
      resource?: { title: string };
      selectedFolderPath?: string[];
      onSelectedFolderPathChange: (path: string[] | undefined) => void;
      onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
      hasExistingPublicationInFolder: boolean;
      hasWriteAccess: boolean;
      isSubmitting: boolean;
      hasSubmitError: boolean;
      onClose: () => void;
      onSubmit: () => void;
    }) => (
      <div role="dialog" aria-label="publish conversation">
        <span>{resource?.title}</span>
        <span>selected:{selectedFolderPath?.join('/') ?? 'none'}</span>
        <span>existing:{String(hasExistingPublicationInFolder)}</span>
        <span>writeAccess:{String(hasWriteAccess)}</span>
        <span>submitting:{String(isSubmitting)}</span>
        {hasSubmitError && <span role="alert">submit failed</span>}
        <button onClick={() => onSelectedFolderPathChange(['Shared'])}>
          Select Shared
        </button>
        <button onClick={() => void onCreateFolder(['Shared'], 'New')}>
          Create folder
        </button>
        <button onClick={onSubmit}>Publish</button>
        <button onClick={onClose}>Close</button>
      </div>
    ),
  };
});

vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../server-api/conversation-publish.api');
vi.mock('../../../context/NotificationContext');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockShowNotification = vi.fn();

const baseFoldersResult = {
  folderItems: [{ path: ['Shared'], name: 'Shared' }],
  expandedPaths: new Set<string>(),
  loadedPaths: new Set<string>(),
  loadingPaths: new Set<string>(),
  onExpandedPathsChange: vi.fn(),
  onCreatePublishFolder: vi.fn(),
  hasPublishWriteAccess: () => true,
};

const renderContainer = async (props?: Partial<{ isOpen: boolean }>) => {
  const result = render(
    <PublishConversationPanelContainer
      isOpen
      conversationPath="my-conversation-abc"
      conversationTitle="Q3 planning notes"
      onClose={vi.fn()}
      {...props}
    />,
  );
  // Let the mount-time publish-history fetch settle before the test interacts.
  await waitFor(() => expect(getConversationPublishHistory).toHaveBeenCalled());
  return result;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePublishFolders).mockReturnValue(baseFoldersResult);
  vi.mocked(getConversationPublishHistory).mockResolvedValue([]);
  vi.mocked(useNotification).mockReturnValue({
    notifications: [],
    showNotification: mockShowNotification,
    dismissNotification: vi.fn(),
  });
});

describe('PublishConversationPanelContainer', () => {
  it('renders the conversation title as the resource summary', async () => {
    await renderContainer();
    expect(screen.getByText('Q3 planning notes')).toBeTruthy();
  });

  it('does not fetch history while the panel is closed', () => {
    render(
      <PublishConversationPanelContainer
        isOpen={false}
        conversationPath="my-conversation-abc"
        conversationTitle="Q3 planning notes"
        onClose={vi.fn()}
      />,
    );
    expect(getConversationPublishHistory).not.toHaveBeenCalled();
  });

  it('selecting a folder updates selectedFolderPath', async () => {
    await renderContainer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    expect(screen.getByText('selected:Shared')).toBeTruthy();
  });

  it('creates publish folders through the shared publish flow', async () => {
    const onCreatePublishFolder = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePublishFolders).mockReturnValue({
      ...baseFoldersResult,
      onCreatePublishFolder,
    });

    await renderContainer();
    await userEvent.click(
      screen.getByRole('button', { name: 'Create folder' }),
    );

    expect(onCreatePublishFolder).toHaveBeenCalledWith(['Shared'], 'New');
  });

  it('publishes successfully: closes the panel and shows a pending-approval success notification without refreshing the conversation list', async () => {
    vi.mocked(publishConversation).mockResolvedValue({
      path: 'conversations/bucket-123/my-conversation-abc',
      folderPath: 'Shared',
      publishedAt: new Date().toISOString(),
      publishedBy: 'Valery Dluski',
    });
    const onClose = vi.fn();
    render(
      <PublishConversationPanelContainer
        isOpen
        conversationPath="my-conversation-abc"
        conversationTitle="Q3 planning notes"
        onClose={onClose}
      />,
    );
    await waitFor(() =>
      expect(getConversationPublishHistory).toHaveBeenCalled(),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(publishConversation).toHaveBeenCalledWith(
        'my-conversation-abc',
        'Shared',
      );
    });
    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'conversationPublish.successMessage',
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('keeps the panel open and surfaces an error when publish fails', async () => {
    vi.mocked(publishConversation).mockRejectedValue(new Error('network'));
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('maps publish-history entries into hasExistingPublicationInFolder for the selected folder', async () => {
    vi.mocked(getConversationPublishHistory).mockResolvedValue([
      {
        path: 'conversations/bucket-123/my-conversation-abc',
        folderPath: 'Shared',
        publishedAt: new Date().toISOString(),
        publishedBy: 'Valery Dluski',
      },
    ]);
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    expect(screen.getByText('existing:true')).toBeTruthy();
  });
});
