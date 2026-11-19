import {
  OrgUnitFolderGuardPurpose,
  PublishTargetTakenError,
} from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
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
import { useOrgUnitFolderGuards } from '../../../hooks/publish/useOrgUnitFolderGuards';
import { usePublishFolders } from '../../../hooks/publish/usePublishFolders';
import { getPublishRules } from '../../../server-api/publish-rules.api';
import {
  getCatalogPublishDependencies,
  getCatalogPublishHistory,
  publishApiClient,
  publishCatalogEntity,
} from '../../../server-api/publish.api';
import PublishProjectPanelContainer from '../PublishProjectPanelContainer';

const mockRule: PublicationRule = {
  source: 'role',
  function: PublicationRuleFunction.Contain,
  targets: ['engineering'],
};

const reasonProp = vi.fn();

vi.mock('@epam/ai-dial-publish-panel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-publish-panel')>();
  return {
    ...actual,
    StandalonePublishPanel: ({
      getDisabledReason,
      resource,
      allowReplace,
      hasExistingPublicationInFolder,
      isTargetTaken,
      isTargetChecking,
      rules,
      onRulesChange,
      onSelectedFolderPathChange,
      onAuthorChange,
      onSubmit,
      labels,
      renderSummary,
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
      renderSummary?: () => ReactNode;
      allowReplace: boolean;
      hasExistingPublicationInFolder: boolean;
      isTargetTaken?: boolean;
      isTargetChecking?: boolean;
      rules: PublicationRule[];
      onRulesChange: (rules: PublicationRule[]) => void;
      onSelectedFolderPathChange: (path: string[] | undefined) => void;
      onAuthorChange: (author: string) => void;
      onSubmit: () => void;
      labels: { ariaLabel: string };
    }) => (
      <div role="dialog" aria-label={labels.ariaLabel}>
        {renderSummary ? renderSummary() : <span>{resource?.title}</span>}
        {reasonProp(getDisabledReason)}
        <span>allowReplace:{String(allowReplace)}</span>
        <span>
          dependencies:
          {dependencies?.map((dependency) => dependency.name).join(',')}
        </span>
        <span>
          dependenciesTitle:{panelLabels?.dependenciesLabels?.title}:
          {panelLabels?.dependenciesLabels?.appearance ?? 'warning'}
        </span>
        <span>alreadyPublished:{String(hasExistingPublicationInFolder)}</span>
        <span>targetTaken:{String(isTargetTaken)}</span>
        <span>targetChecking:{String(isTargetChecking)}</span>
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

vi.mock('../../../hooks/publish/useOrgUnitFolderGuards', () => ({
  useOrgUnitFolderGuards: vi.fn(),
}));
vi.mock('../../../hooks/publish/usePublishFolders');
vi.mock('../../../hooks/publish/usePublishDependencyIconResolver', () => ({
  usePublishDependencyIconResolver: () => () => undefined,
}));
vi.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => ({ displayName: 'Jane Doe' }),
}));
vi.mock('../../../server-api/publish.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server-api/publish.api')>()),
  publishCatalogEntity: vi.fn(),
  getCatalogPublishHistory: vi.fn(),
  getCatalogPublishDependencies: vi.fn(),
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

const renderContainer = (
  onClose = vi.fn(),
  conversationCount?: number,
  onPublished = vi.fn(),
) => {
  render(
    <PublishProjectPanelContainer
      isOpen
      projectId="projects/a1b2c3/q4-launch"
      projectName="q4-launch"
      conversationCount={conversationCount}
      onClose={onClose}
      onPublished={onPublished}
    />,
  );
  return { onClose, onPublished };
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
    vi.mocked(useOrgUnitFolderGuards).mockReturnValue({
      isDestinationUsable: undefined,
      getDisabledReason: undefined,
      canSaveDirectlyTo: undefined,
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

  it('builds the folder guards for the projects namespace and gives the destination guard to the folder tree as canPublishTo', () => {
    const isDestinationUsable = vi.fn().mockReturnValue(true);
    vi.mocked(useOrgUnitFolderGuards).mockReturnValue({
      isDestinationUsable,
      getDisabledReason: undefined,
      canSaveDirectlyTo: undefined,
    });

    renderContainer();

    expect(useOrgUnitFolderGuards).toHaveBeenCalledWith({
      purpose: OrgUnitFolderGuardPurpose.Publish,
      namespace: OrgUnitNamespace.Projects,
      isActive: true,
    });
    expect(usePublishFolders).toHaveBeenCalledWith({
      canPublishTo: isDestinationUsable,
    });
  });

  it('does not activate the org-unit read while the panel is closed', () => {
    render(
      <PublishProjectPanelContainer
        isOpen={false}
        projectId="projects/a1b2c3/q4-launch"
        projectName="q4-launch"
        onClose={vi.fn()}
        onPublished={vi.fn()}
      />,
    );

    expect(useOrgUnitFolderGuards).toHaveBeenCalledWith({
      purpose: OrgUnitFolderGuardPurpose.Publish,
      namespace: OrgUnitNamespace.Projects,
      isActive: false,
    });
  });

  it('gives the folder tree a reason callback that judges the destination path', () => {
    const getDisabledReason = vi.fn().mockReturnValue('No access');
    vi.mocked(useOrgUnitFolderGuards).mockReturnValue({
      isDestinationUsable: vi.fn(),
      getDisabledReason,
      canSaveDirectlyTo: undefined,
    });

    renderContainer();

    const reason = reasonProp.mock.lastCall?.[0];
    expect(reason({ rootKey: '', path: ['Acme', 'Secret'] })).toBe('No access');
    expect(getDisabledReason).toHaveBeenCalledWith(['Acme', 'Secret']);
  });

  it('gives the folder tree no reason callback when no guard applies', () => {
    renderContainer();

    expect(reasonProp.mock.lastCall?.[0]).toBeUndefined();
  });

  it('keeps the Production fallback when no guard applies', () => {
    renderContainer();

    expect(usePublishFolders).toHaveBeenCalledWith({
      canPublishTo: undefined,
    });
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

  it('tells the host after a successful publish so it can re-read the publish state', async () => {
    vi.mocked(publishCatalogEntity).mockResolvedValue({} as never);
    const { onPublished } = renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Marketing' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(onPublished).toHaveBeenCalledOnce());
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

  it('does not tell the host about a failed publish', async () => {
    vi.mocked(publishCatalogEntity).mockRejectedValue(new Error('denied'));
    const { onPublished } = renderContainer();

    await userEvent.click(
      screen.getByRole('button', { name: 'Select Marketing' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(mockShowPublishError).toHaveBeenCalled());
    expect(onPublished).not.toHaveBeenCalled();
  });

  describe('target collision', () => {
    const takenResponse = () =>
      Object.assign(new Error('conflict'), {
        response: new Response(
          JSON.stringify({
            statusCode: 409,
            message: 'taken',
            error: 'Conflict',
            code: 'target-exists',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      });

    it('asks whether the project name is taken in the selected folder and flags it', async () => {
      const check = vi
        .spyOn(publishApiClient, 'checkPublishTarget')
        .mockResolvedValue({ taken: true });
      renderContainer();

      await userEvent.click(
        screen.getByRole('button', { name: 'Select Marketing' }),
      );

      expect(await screen.findByText('targetTaken:true')).toBeTruthy();
      expect(check).toHaveBeenCalledWith(
        'project',
        'projects/a1b2c3/q4-launch',
        'Marketing',
        undefined,
      );
    });

    it('does not flag a free folder', async () => {
      vi.spyOn(publishApiClient, 'checkPublishTarget').mockResolvedValue({
        taken: false,
      });
      renderContainer();

      await userEvent.click(
        screen.getByRole('button', { name: 'Select Marketing' }),
      );

      expect(await screen.findByText('targetChecking:false')).toBeTruthy();
      expect(screen.getByText('targetTaken:false')).toBeTruthy();
    });

    it('flags the target and reports an unversioned text when the publish answers target-exists', async () => {
      vi.spyOn(publishApiClient, 'checkPublishTarget').mockResolvedValue({
        taken: false,
      });
      vi.mocked(publishCatalogEntity).mockRejectedValue(takenResponse());
      const { onClose } = renderContainer();
      await userEvent.click(
        screen.getByRole('button', { name: 'Select Marketing' }),
      );
      expect(await screen.findByText('targetChecking:false')).toBeTruthy();

      await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

      expect(await screen.findByText('targetTaken:true')).toBeTruthy();
      expect(mockShowPublishError).toHaveBeenCalledWith(
        expect.any(PublishTargetTakenError),
        undefined,
        { isVersioned: false },
      );
      expect(onClose).not.toHaveBeenCalled();
    });
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

  describe('private dependencies', () => {
    it('keeps the warning copy of the shared dependencies section', () => {
      renderContainer();

      expect(
        screen.getByText(
          /dependenciesTitle:publish\.dependenciesTitle:\s*warning/,
        ),
      ).toBeTruthy();
    });

    it("asks for the project's dependencies and shows none while the list is empty", async () => {
      vi.mocked(getCatalogPublishDependencies).mockResolvedValue({
        dependencies: [],
      });

      renderContainer();

      await waitFor(() =>
        expect(getCatalogPublishDependencies).toHaveBeenCalledWith(
          'project',
          'projects/a1b2c3/q4-launch',
        ),
      );
      expect(screen.getByText('dependencies:')).toBeTruthy();
    });

    it('passes a supplied list to the panel', async () => {
      vi.mocked(getCatalogPublishDependencies).mockResolvedValue({
        dependencies: [
          { id: 'files/x/a.txt', name: 'a.txt', type: 'file', location: '' },
        ],
      });

      renderContainer();

      expect(await screen.findByText('dependencies:a.txt')).toBeTruthy();
    });
  });
});
