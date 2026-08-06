import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { PublicationRuleFunction } from '@epam/ai-dial-publish-panel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from '../../../context/NotificationContext';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { publishConversation } from '../../../server-api/conversation-publish.api';
import { getPublishRules } from '../../../server-api/publish-rules.api';
import PublishConversationPanelContainer from '../PublishConversationPanelContainer';

const mockRule: PublicationRule = {
  source: 'role',
  function: PublicationRuleFunction.Contain,
  targets: ['engineering'],
};

vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-publish-panel')>();
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
      rules,
      onRulesChange,
      ruleSourceOptions,
      isRulesLoading,
      hasRulesLoadError,
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
      rules: PublicationRule[];
      onRulesChange: (rules: PublicationRule[]) => void;
      ruleSourceOptions: string[];
      isRulesLoading?: boolean;
      hasRulesLoadError?: boolean;
      onClose: () => void;
      onSubmit: () => void;
    }) => (
      <div role="dialog" aria-label="publish conversation">
        <span>{resource?.title}</span>
        <span>selected:{selectedFolderPath?.join('/') ?? 'none'}</span>
        <span>existing:{String(hasExistingPublicationInFolder)}</span>
        <span>writeAccess:{String(hasWriteAccess)}</span>
        <span>submitting:{String(isSubmitting)}</span>
        <span>ruleSourceOptions:{ruleSourceOptions.join(',')}</span>
        <span>rules:{rules.map((r) => r.source).join(',')}</span>
        <span>rulesLoading:{String(isRulesLoading)}</span>
        <span>rulesLoadError:{String(hasRulesLoadError)}</span>
        {hasSubmitError && <span role="alert">submit failed</span>}
        <button onClick={() => onSelectedFolderPathChange(['Shared'])}>
          Select Shared
        </button>
        <button onClick={() => onSelectedFolderPathChange(undefined)}>
          Deselect folder
        </button>
        <button onClick={() => void onCreateFolder(['Shared'], 'New')}>
          Create folder
        </button>
        <button onClick={() => onRulesChange([...rules, mockRule])}>
          Add mock rule
        </button>
        <button onClick={onSubmit}>Publish</button>
        <button onClick={onClose}>Close</button>
      </div>
    ),
  };
});

vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../server-api/conversation-publish.api');
vi.mock('../../../server-api/publish-rules.api');
vi.mock('../../../context/NotificationContext');

const mockShowPublishError = vi.fn();
vi.mock('../../../hooks/publish/usePublishErrorNotification', () => ({
  usePublishErrorNotification: () => mockShowPublishError,
}));

const useAppConfigMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useAppConfig: () => useAppConfigMock(),
}));

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

const renderContainer = (props?: Partial<{ isOpen: boolean }>) =>
  render(
    <PublishConversationPanelContainer
      isOpen
      conversationPath="my-conversation-abc"
      conversationTitle="Q3 planning notes"
      onClose={vi.fn()}
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePublishFolders).mockReturnValue(baseFoldersResult);
  vi.mocked(useNotification).mockReturnValue({
    notifications: [],
    showNotification: mockShowNotification,
    dismissNotification: vi.fn(),
  });
  useAppConfigMock.mockReturnValue({
    config: { publicationFilterSources: ['title', 'role', 'dial_roles'] },
  });
  vi.mocked(getPublishRules).mockResolvedValue([]);
});

describe('PublishConversationPanelContainer', () => {
  it('renders the conversation title as the resource summary', async () => {
    await renderContainer();
    expect(screen.getByText('Q3 planning notes')).toBeTruthy();
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
      publishedBy: 'Test User',
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

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(publishConversation).toHaveBeenCalledWith(
        'my-conversation-abc',
        'Shared',
        [],
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

  it('forwards rules added in the panel to publishConversation', async () => {
    vi.mocked(publishConversation).mockResolvedValue({
      path: 'conversations/bucket-123/my-conversation-abc',
      folderPath: 'Shared',
      publishedAt: new Date().toISOString(),
      publishedBy: 'Test User',
    });
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Add mock rule' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(publishConversation).toHaveBeenCalledWith(
        'my-conversation-abc',
        'Shared',
        [mockRule],
      );
    });
  });

  it('keeps the panel open, shows the inline callout, and reports an error notification when publish fails', async () => {
    const rejection = new Error('network');
    vi.mocked(publishConversation).mockRejectedValue(rejection);
    const onClose = vi.fn();
    render(
      <PublishConversationPanelContainer
        isOpen
        conversationPath="my-conversation-abc"
        conversationTitle="Q3 planning notes"
        onClose={onClose}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mockShowPublishError).toHaveBeenCalledWith(rejection);
    expect(mockShowNotification).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never reports an existing publication in the folder (version history is not fetched, see GH issue #7897)', async () => {
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    expect(screen.getByText('existing:false')).toBeTruthy();
  });

  it('sources ruleSourceOptions from useAppConfig, not a hardcoded list', async () => {
    useAppConfigMock.mockReturnValue({
      config: { publicationFilterSources: ['roles', 'department'] },
    });
    await renderContainer();

    expect(screen.getByText('ruleSourceOptions:roles,department')).toBeTruthy();
  });

  it('selecting a folder triggers getPublishRules and pre-fills the editor', async () => {
    vi.mocked(getPublishRules).mockResolvedValue([mockRule]);
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    await waitFor(() => {
      expect(getPublishRules).toHaveBeenCalledWith('Shared');
    });
    await waitFor(() => {
      expect(screen.getByText('rules:role')).toBeTruthy();
    });
  });

  it('a rules-lookup failure does not block folder selection or submission', async () => {
    vi.mocked(getPublishRules).mockRejectedValue(new Error('network'));
    vi.mocked(publishConversation).mockResolvedValue({
      path: 'conversations/bucket-123/my-conversation-abc',
      folderPath: 'Shared',
      publishedAt: new Date().toISOString(),
      publishedBy: 'Test User',
    });
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    await waitFor(() => {
      expect(screen.getByText('rulesLoadError:true')).toBeTruthy();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => {
      expect(publishConversation).toHaveBeenCalled();
    });
  });

  it('resets rules when the panel closes and reopens', async () => {
    vi.mocked(getPublishRules).mockResolvedValue([]);
    const { rerender } = render(
      <PublishConversationPanelContainer
        isOpen
        conversationPath="my-conversation-abc"
        conversationTitle="Q3 planning notes"
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Add mock rule' }),
    );
    expect(screen.getByText('rules:role')).toBeTruthy();

    rerender(
      <PublishConversationPanelContainer
        isOpen={false}
        conversationPath="my-conversation-abc"
        conversationTitle="Q3 planning notes"
        onClose={vi.fn()}
      />,
    );
    rerender(
      <PublishConversationPanelContainer
        isOpen
        conversationPath="my-conversation-abc"
        conversationTitle="Q3 planning notes"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('rules:')).toBeTruthy();
  });
});
