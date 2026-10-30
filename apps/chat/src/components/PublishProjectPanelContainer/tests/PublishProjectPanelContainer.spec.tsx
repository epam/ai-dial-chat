import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { PublicationRuleFunction } from '@epam/ai-dial-publish-panel';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsI18nKeys } from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import { useAppConfig as useAppConfigMock } from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { getPublishRules } from '../../../server-api/publish-rules.api';
import {
  getCatalogPublishHistory,
  publishCatalogEntity,
} from '../../../server-api/publish.api';
import PublishProjectPanelContainer from '../PublishProjectPanelContainer';

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
      allowReplace,
      hasExistingPublicationInFolder,
      rules,
      onRulesChange,
      onSelectedFolderPathChange,
      onAuthorChange,
      onSubmit,
      labels,
      renderSummary,
    }: {
      resource?: { title: string };
      renderSummary?: () => ReactNode;
      allowReplace: boolean;
      hasExistingPublicationInFolder: boolean;
      rules: PublicationRule[];
      onRulesChange: (rules: PublicationRule[]) => void;
      onSelectedFolderPathChange: (path: string[] | undefined) => void;
      onAuthorChange: (author: string) => void;
      onSubmit: () => void;
      labels: { ariaLabel: string };
    }) => (
      <div role="dialog" aria-label={labels.ariaLabel}>
        {renderSummary ? renderSummary() : <span>{resource?.title}</span>}
        <span>allowReplace:{String(allowReplace)}</span>
        <span>alreadyPublished:{String(hasExistingPublicationInFolder)}</span>
        <button onClick={() => onSelectedFolderPathChange(['Marketing'])}>
          Select Marketing
        </button>
        <button onClick={() => onRulesChange([...rules, mockRule])}>
          Add mock rule
        </button>
        <button onClick={() => onAuthorChange('  ')}>Clear author</button>
        <button onClick={onSubmit}>Publish</button>
      </div>
    ),
  };
});

vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => ({ displayName: 'Jane Doe' }),
}));
vi.mock('../../../server-api/publish.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server-api/publish.api')>()),
  publishCatalogEntity: vi.fn(),
  getCatalogPublishHistory: vi.fn(),
}));
vi.mock('../../../server-api/publish-rules.api');
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

const renderContainer = (onClose = vi.fn(), conversationCount?: number) => {
  render(
    <PublishProjectPanelContainer
      isOpen
      projectId="projects/a1b2c3/q4-launch"
      projectName="q4-launch"
      conversationCount={conversationCount}
      onClose={onClose}
    />,
  );
  return { onClose };
};

describe('PublishProjectPanelContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublishFolders).mockReturnValue({
      folderItems: [{ path: ['Marketing'], name: 'Marketing' }],
      expandedPaths: new Set<string>(),
      loadedPaths: new Set<string>(),
      loadingPaths: new Set<string>(),
      onExpandedPathsChange: vi.fn(),
      onCreatePublishFolder: vi.fn(),
      rememberPublishFolder: mockRememberPublishFolder,
      hasPublishWriteAccess: () => true,
    });
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(mockShowNotification),
    );
    useAppConfigMock.mockReturnValue({
      config: { publicationFilterSources: ['role'] },
    });
    vi.mocked(getPublishRules).mockResolvedValue([]);
    vi.mocked(getCatalogPublishHistory).mockResolvedValue([]);
  });

  it('names the project and never offers to replace a publication', () => {
    renderContainer();

    expect(
      screen.getByRole('dialog', { name: 'projects.publish.panelAriaLabel' }),
    ).toBeTruthy();
    expect(screen.getByText('q4-launch')).toBeTruthy();
    expect(screen.getByText('allowReplace:false')).toBeTruthy();
  });

  it('flags a folder that already holds the project from its publish history', async () => {
    vi.mocked(getCatalogPublishHistory).mockResolvedValue([
      { folderPath: 'Marketing', publishedAt: '2026-10-01T00:00:00Z' },
    ] as never);
    renderContainer();

    await waitFor(() =>
      expect(getCatalogPublishHistory).toHaveBeenCalledWith(
        'project',
        'projects/a1b2c3/q4-launch',
      ),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Select Marketing' }),
    );

    expect(await screen.findByText('alreadyPublished:true')).toBeTruthy();
  });

  it('treats a failed history lookup as no publications', async () => {
    vi.mocked(getCatalogPublishHistory).mockRejectedValue(new Error('down'));
    renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Marketing' }),
    );

    await waitFor(() => expect(getCatalogPublishHistory).toHaveBeenCalled());
    expect(screen.getByText('alreadyPublished:false')).toBeTruthy();
  });

  it('publishes the whole project as a project entity and closes on success', async () => {
    vi.mocked(publishCatalogEntity).mockResolvedValue({} as never);
    const { onClose } = renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Marketing' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Add mock rule' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(publishCatalogEntity).toHaveBeenCalledWith(
      'project',
      'projects/a1b2c3/q4-launch',
      {
        folderPath: 'Marketing',
        author: 'Jane Doe',
        rules: [
          expect.objectContaining({
            source: 'role',
            targets: ['engineering'],
          }),
        ],
      },
    );
    expect(mockRememberPublishFolder).toHaveBeenCalledWith(['Marketing']);
    expect(mockShowNotification).toHaveBeenCalled();
  });

  it('omits an empty author so the backend falls back to the session name', async () => {
    vi.mocked(publishCatalogEntity).mockResolvedValue({} as never);
    renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Marketing' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear author' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(publishCatalogEntity).toHaveBeenCalled());
    expect(vi.mocked(publishCatalogEntity).mock.calls[0][2]).not.toHaveProperty(
      'author',
    );
  });

  it('reports a failed publish through the publish error notification', async () => {
    vi.mocked(publishCatalogEntity).mockRejectedValue(new Error('denied'));
    const { onClose } = renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Marketing' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(mockShowPublishError).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('PublishProjectPanelContainer — chats warning', () => {
    it('warns that the chats are published with the project', () => {
      renderContainer(vi.fn(), 2);

      expect(
        screen.getByText(ProjectsI18nKeys.PublishChatsWarning),
      ).toBeTruthy();
      expect(screen.getByText('q4-launch')).toBeTruthy();
    });

    it('shows no warning for a project without chats', () => {
      renderContainer(vi.fn(), 0);

      expect(
        screen.queryByText(ProjectsI18nKeys.PublishChatsWarning),
      ).toBeNull();
    });
  });
});
