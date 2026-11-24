import { OrgUnitFolderGuardPurpose } from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from '../../../context/NotificationContext';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { useOrgUnitFolderGuards } from '../../../hooks/publish/useOrgUnitFolderGuards';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import {
  getConversationPublishDependencies,
  publishConversation,
} from '../../../server-api/conversation-publish.api';
import PublishConversationPanelContainer from '../PublishConversationPanelContainer';

const reasonProp = vi.fn();

vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-publish-panel')>();
  return {
    ...actual,
    StandalonePublishPanel: ({
      getDisabledReason,
      resource,
      selectedFolderPath,
      onSelectedFolderPathChange,
      onCreateFolder,
      hasExistingPublicationInFolder,
      hasWriteAccess,
      isSubmitting,
      hasSubmitError,
      author,
      onAuthorChange,
      onClose,
      onSubmit,
      dependencies,
      panelLabels,
    }: {
      dependencies?: { name: string }[];
      panelLabels?: {
        dependenciesLabels?: { title?: string; appearance?: string };
      };
      getDisabledReason?: (destination: {
        path: string[];
      }) => string | undefined;
      resource?: { title: string };
      selectedFolderPath?: string[];
      onSelectedFolderPathChange: (path: string[] | undefined) => void;
      onCreateFolder: (parentPath: string[], name: string) => Promise<void>;
      hasExistingPublicationInFolder: boolean;
      hasWriteAccess: boolean;
      isSubmitting: boolean;
      hasSubmitError: boolean;
      author: string;
      onAuthorChange: (author: string) => void;
      onClose: () => void;
      onSubmit: () => void;
    }) => (
      <div role="dialog" aria-label="publish conversation">
        <span>{resource?.title}</span>
        {reasonProp(getDisabledReason)}
        <span>
          dependencies:
          {dependencies?.map((dependency) => dependency.name).join(',')}
        </span>
        <span>
          dependenciesTitle:{panelLabels?.dependenciesLabels?.title}:
          {panelLabels?.dependenciesLabels?.appearance ?? 'warning'}
        </span>
        <span>selected:{selectedFolderPath?.join('/') ?? 'none'}</span>
        <span>existing:{String(hasExistingPublicationInFolder)}</span>
        <span>writeAccess:{String(hasWriteAccess)}</span>
        <span>submitting:{String(isSubmitting)}</span>
        <span>author:{author}</span>
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
        <button onClick={() => onAuthorChange('DIAL Team')}>Set author</button>
        <button onClick={() => onAuthorChange('   ')}>Clear author</button>
        <button onClick={onSubmit}>Publish</button>
        <button onClick={onClose}>Close</button>
      </div>
    ),
  };
});

vi.mock('../../../hooks/publish/useOrgUnitFolderGuards', () => ({
  useOrgUnitFolderGuards: vi.fn(),
}));
vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../hooks/publish/usePublishDependencyIconResolver', () => ({
  usePublishDependencyIconResolver: () => () => undefined,
}));
vi.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => ({ displayName: 'Daniil Pavlov' }),
}));
vi.mock('../../../server-api/conversation-publish.api');
vi.mock('../../../context/NotificationContext');

const mockShowPublishError = vi.fn();
vi.mock('../../../hooks/publish/usePublishErrorNotification', () => ({
  usePublishErrorNotification: () => mockShowPublishError,
}));

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockShowNotification = vi.fn();

const mockRememberPublishFolder = vi.fn();

const baseFoldersResult = {
  folderItems: [{ path: ['Shared'], name: 'Shared' }],
  expandedPaths: new Set<string>(),
  loadedPaths: new Set<string>(),
  loadingPaths: new Set<string>(),
  onExpandedPathsChange: vi.fn(),
  onCreatePublishFolder: vi.fn(),
  rememberPublishFolder: mockRememberPublishFolder,
  hasPublishWriteAccess: () => true,
};

const renderContainer = (
  props?: Partial<ComponentProps<typeof PublishConversationPanelContainer>>,
) =>
  render(
    <PublishConversationPanelContainer
      isOpen
      conversationPath="my-conversation-abc"
      conversationTitle="Q3 planning notes"
      onClose={vi.fn()}
      {...props}
    />,
  );

describe('PublishConversationPanelContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishFolders).mockReturnValue(baseFoldersResult);
    vi.mocked(useOrgUnitFolderGuards).mockReturnValue({
      isDestinationUsable: undefined,
      getDisabledReason: undefined,
      canSaveDirectlyTo: undefined,
    });
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
  });

  it('renders the conversation title as the resource summary', async () => {
    await renderContainer();
    expect(screen.getByText('Q3 planning notes')).toBeTruthy();
  });

  it('builds the folder guards for the conversations namespace and gives the destination guard to the folder tree as canPublishTo', async () => {
    const isDestinationUsable = vi.fn().mockReturnValue(true);
    vi.mocked(useOrgUnitFolderGuards).mockReturnValue({
      isDestinationUsable,
      getDisabledReason: undefined,
      canSaveDirectlyTo: undefined,
    });

    await renderContainer();

    expect(useOrgUnitFolderGuards).toHaveBeenCalledWith({
      purpose: OrgUnitFolderGuardPurpose.Publish,
      namespace: OrgUnitNamespace.Conversations,
      isActive: true,
    });
    expect(usePublishFolders).toHaveBeenCalledWith({
      canPublishTo: isDestinationUsable,
    });
  });

  it('does not activate the org-unit read while the panel is closed', async () => {
    await renderContainer({ isOpen: false });

    expect(useOrgUnitFolderGuards).toHaveBeenCalledWith({
      purpose: OrgUnitFolderGuardPurpose.Publish,
      namespace: OrgUnitNamespace.Conversations,
      isActive: false,
    });
  });

  it('gives the folder tree a reason callback that judges the destination path', async () => {
    const getDisabledReason = vi.fn().mockReturnValue('No access');
    vi.mocked(useOrgUnitFolderGuards).mockReturnValue({
      isDestinationUsable: vi.fn(),
      getDisabledReason,
      canSaveDirectlyTo: undefined,
    });

    await renderContainer();

    const reason = reasonProp.mock.lastCall?.[0];
    expect(reason({ rootKey: '', path: ['Acme', 'Secret'] })).toBe('No access');
    expect(getDisabledReason).toHaveBeenCalledWith(['Acme', 'Secret']);
  });

  it('gives the folder tree no reason callback when no guard applies', async () => {
    await renderContainer();

    expect(reasonProp.mock.lastCall?.[0]).toBeUndefined();
  });

  it('keeps the Production fallback when no guard applies', async () => {
    await renderContainer();

    expect(usePublishFolders).toHaveBeenCalledWith({
      canPublishTo: undefined,
    });
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
        'Daniil Pavlov',
      );
    });
    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith({
        variant: 'success',
        title: 'entityNotifications.conversation.publishRequestedTitle',
        message: 'entityNotifications.conversation.publishRequested',
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('remembers the destination folder after a successful publish so it stays available next time', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(mockRememberPublishFolder).toHaveBeenCalledWith(['Shared']);
    });
  });

  it('does not remember the destination folder when publish fails', async () => {
    vi.mocked(publishConversation).mockRejectedValue(new Error('network'));
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(mockRememberPublishFolder).not.toHaveBeenCalled();
  });

  it('pre-fills the author field with the signed-in user display name', async () => {
    await renderContainer();

    expect(screen.getByText('author:Daniil Pavlov')).toBeTruthy();
  });

  it('forwards an edited author to publishConversation', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Set author' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(publishConversation).toHaveBeenCalledWith(
        'my-conversation-abc',
        'Shared',
        'DIAL Team',
      );
    });
  });

  it('forwards a cleared author as an empty string', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Clear author' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(publishConversation).toHaveBeenCalledWith(
        'my-conversation-abc',
        'Shared',
        '',
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

  it('reports no existing publication for a folder absent from the handed-down history', async () => {
    await renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    expect(screen.getByText('existing:false')).toBeTruthy();
  });

  /*
   * `allowReplace={false}` became observable once history stopped being
   * hardcoded empty: a conversation carries no version, so a second publish
   * to the same folder would create a duplicate public copy rather than an
   * update. See the change's `openspec/changes/archive/2026-08-24-add-unpublish-my-resources/design.md` D6.
   */
  it('reports an existing publication for a folder the handed-down history names', async () => {
    await renderContainer({
      history: [{ publishedAt: 1_700_000_000_000, folderPath: ['Shared'] }],
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Shared' }),
    );

    expect(screen.getByText('existing:true')).toBeTruthy();
  });

  describe('private dependencies', () => {
    it('keeps the warning copy of the shared dependencies section', () => {
      renderContainer();

      expect(
        screen.getByText(
          /dependenciesTitle:publish\.dependenciesTitle:\s*warning/,
        ),
      ).toBeTruthy();
    });

    it("passes the conversation's dependencies to the panel", async () => {
      vi.mocked(getConversationPublishDependencies).mockResolvedValue({
        dependencies: [
          { id: 'skills/b/Docs', name: 'Docs', type: 'skill', location: '' },
        ],
      } as never);

      renderContainer();

      expect(await screen.findByText('dependencies:Docs')).toBeTruthy();
      expect(getConversationPublishDependencies).toHaveBeenCalledWith(
        'my-conversation-abc',
      );
    });

    it('shows an empty list and still publishes when the lookup fails', async () => {
      vi.mocked(getConversationPublishDependencies).mockRejectedValue(
        new Error('offline'),
      );
      vi.mocked(publishConversation).mockResolvedValue({} as never);
      renderContainer();

      await waitFor(() =>
        expect(getConversationPublishDependencies).toHaveBeenCalledOnce(),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Select Shared' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

      expect(screen.getByText('dependencies:')).toBeTruthy();
      await waitFor(() => expect(publishConversation).toHaveBeenCalledOnce());
    });

    it('does not look dependencies up while the panel is closed', () => {
      renderContainer({ isOpen: false });

      expect(getConversationPublishDependencies).not.toHaveBeenCalled();
    });
  });
});
