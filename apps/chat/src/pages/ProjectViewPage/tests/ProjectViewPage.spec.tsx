import {
  ProjectSource,
  ResponseError,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { triggerBrowserDownload } from '@epam/ai-dial-chat-hooks/utils';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  NotFoundI18nKeys,
  ProjectsI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  previewResolvers,
  withPreviewCanvas,
} from '../../../hooks/projects/tests/project-preview-test-helpers';
import { listProjectConversations } from '../../../server-api/project-conversations.api';
import {
  deleteProject,
  downloadProjectArchive,
  getProject,
  listProjectArtifacts,
  watchProjects,
} from '../../../server-api/projects.api';
import {
  getCatalogPublishHistory,
  getCatalogUnpublishAccess,
  unpublishCatalogEntity,
} from '../../../server-api/publish.api';
import ProjectViewPage from '../ProjectViewPage';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(showNotificationMock),
}));
const userConfig = vi.hoisted(() => ({
  pinnedProjectIds: [] as string[],
  setPinnedProject: vi.fn(async () => undefined),
  replacePinnedProjectId: vi.fn(),
}));
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => userConfig,
}));
vi.mock('../../../server-api/projects.api', () => ({
  getProject: vi.fn(),
  deleteProject: vi.fn(),
  downloadProjectArchive: vi.fn(),
  listProjectArtifacts: vi.fn(),
  watchProjects: vi.fn(),
}));
const session = vi.hoisted(() => ({ user: { isAdmin: false } }));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => session,
}));
/* The page's unpublish lookup goes through `publishApiClient`; the named exports are the same mocks. */
const publishMocks = vi.hoisted(() => ({
  getCatalogPublishHistory: vi.fn(),
  getCatalogUnpublishAccess: vi.fn(),
}));
vi.mock('../../../server-api/publish.api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server-api/publish.api')>();
  return {
    ...actual,
    ...publishMocks,
    publishApiClient: { ...actual.publishApiClient, ...publishMocks },
    unpublishCatalogEntity: vi.fn(),
  };
});
vi.mock('../../../server-api/project-conversations.api', () => ({
  listProjectConversations: vi.fn(),
  markProjectConversationViewed: vi.fn(),
}));
vi.mock('@epam/ai-dial-chat-hooks/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks/utils')>()),
  triggerBrowserDownload: vi.fn(
    async (_response: Response, name: string) => name,
  ),
}));
vi.mock('../../../hooks/attachment/useAttachmentCanvasResolvers', async () => {
  const { previewCanvasResolvers: stub } =
    await import('../../../hooks/projects/tests/project-preview-test-helpers');
  return { useAttachmentCanvasResolvers: () => stub };
});
vi.mock(
  '../../../components/PublishProjectPanelContainer/PublishProjectPanelContainer',
  () => ({
    default: ({ isOpen, projectId }: { isOpen: boolean; projectId: string }) =>
      isOpen ? (
        <div role="dialog" aria-label="publish">
          {projectId}
        </div>
      ) : (
        <span>publish panel mounted</span>
      ),
  }),
);
vi.mock(
  '../../../components/ProjectConversationsSection/ProjectConversationsSection',
  () => ({
    default: ({
      projectId,
      canEdit,
      conversations,
      onConversationDeleted,
      outputs,
      hasOutputs,
    }: {
      projectId: string;
      canEdit: boolean;
      conversations: { items: { title: string; isUnread?: boolean }[] };
      onConversationDeleted?: () => void;
      outputs?: ReactNode;
      hasOutputs?: boolean;
    }) => (
      <>
        <p>{`chats of ${projectId}, editable: ${String(canEdit)}`}</p>
        <p>{`has outputs: ${String(hasOutputs)}`}</p>
        {outputs}
        <ul aria-label="chat rows">
          {conversations.items.map((item) => (
            <li key={item.title}>
              {`${item.title}${item.isUnread ? ' (unread)' : ''}`}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onConversationDeleted}>
          delete a chat
        </button>
      </>
    ),
  }),
);
vi.mock('../../../components/ProjectShareOverlay/ProjectShareOverlay', () => ({
  default: ({ projectId }: { projectId: string }) => (
    <div role="dialog" aria-label="share">
      {projectId}
    </div>
  ),
}));

const PROJECT_ID = 'projects/a1b2c3/marketing/q4';

const details = (
  extra: Partial<ProjectDetailsDto> = {},
): ProjectDetailsDto => ({
  id: PROJECT_ID,
  name: 'q4',
  bucket: 'a1b2c3',
  path: 'marketing/q4',
  parentPath: 'marketing',
  source: ProjectSource.Personal,
  description: 'About Q4',
  instructions: '',
  contextFiles: [{ name: 'tickets.csv', size: 2048 }],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 0,
  canEdit: true,
  canManage: true,
  ...extra,
});

const READY_CONFIG = {
  status: 'ready',
  config: { projectContextTotalMaxBytes: 10_485_760 },
};

const renderAt = (path = '/projects/view/a1b2c3/marketing/q4') => {
  const router = createMemoryRouter(
    [
      { path: '/projects/view/:bucket/*', element: <ProjectViewPage /> },
      { path: '/projects/edit/:bucket/*', element: <p>edit page</p> },
      { path: '/projects', element: <p>projects list</p> },
    ],
    { initialEntries: [path] },
  );
  render(withPreviewCanvas(<RouterProvider router={router} />));
  return { router };
};

const openMenu = async () => {
  await userEvent.click(
    screen.getAllByRole('button', { name: ButtonsI18nKeys.MoreActions })[0],
  );
  return screen.findByRole('menu');
};

describe('ProjectViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userConfig.pinnedProjectIds = [];
    useAppConfigMock.mockReturnValue(READY_CONFIG);
    useFeatureFlagMock.mockReturnValue(true);
    vi.mocked(getProject).mockResolvedValue(details());
    /* Without a stream the page behaves as on a Core without project events. */
    vi.mocked(watchProjects).mockRejectedValue(new Error('no watch'));
    vi.mocked(listProjectConversations).mockResolvedValue({
      items: [],
    });
    vi.mocked(listProjectArtifacts).mockResolvedValue({ items: [] });
    session.user.isAdmin = false;
    vi.mocked(getCatalogPublishHistory).mockResolvedValue([]);
  });

  it('renders NotFound without a request when the flag is off', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderAt();

    expect(screen.getByText(NotFoundI18nKeys.Title)).toBeTruthy();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('loads the project named by the route and renders it', async () => {
    renderAt();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'q4' }),
    ).toBeTruthy();
    expect(screen.getByText('About Q4')).toBeTruthy();
    expect(getProject).toHaveBeenCalledWith(PROJECT_ID, {
      signal: expect.any(AbortSignal),
    });
  });

  it('shows the not-found state for an unsafe route without a request', () => {
    renderAt('/projects/view/a1b2c3/../x');

    expect(screen.getByText(ProjectsI18nKeys.ViewNotFound)).toBeTruthy();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('shows the not-found state for a missing project', async () => {
    vi.mocked(getProject).mockRejectedValue(
      new ResponseError(new Response(null, { status: 404 })),
    );
    renderAt();

    expect(await screen.findByText(ProjectsI18nKeys.ViewNotFound)).toBeTruthy();
  });

  it('opens a shared project read-only: Pin and Download only', async () => {
    vi.mocked(getProject).mockResolvedValue(
      details({
        source: ProjectSource.Shared,
        canEdit: false,
        canManage: false,
      }),
    );
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.Edit }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.Publish }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.Pin }),
    ).toBeTruthy();
    const menu = await openMenu();
    expect(
      within(menu).queryByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    ).toBeNull();
    expect(
      within(menu).queryByRole('menuitem', { name: ButtonsI18nKeys.Share }),
    ).toBeNull();
    expect(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Download }),
    ).toBeTruthy();
  });

  it('lets a shared editor edit and chat but not publish, share or delete', async () => {
    vi.mocked(getProject).mockResolvedValue(
      details({
        source: ProjectSource.Shared,
        canEdit: true,
        canManage: false,
      }),
    );
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.Edit }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: ButtonsI18nKeys.Publish }),
    ).toBeNull();
    expect(
      screen.getByText(`chats of ${PROJECT_ID}, editable: true`),
    ).toBeTruthy();
    const menu = await openMenu();
    expect(
      within(menu).queryByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    ).toBeNull();
    expect(
      within(menu).queryByRole('menuitem', { name: ButtonsI18nKeys.Share }),
    ).toBeNull();
    expect(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Download }),
    ).toBeTruthy();
  });

  it('pins the project through the user config', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Pin }),
    );

    expect(userConfig.setPinnedProject).toHaveBeenCalledWith(PROJECT_ID, true);
  });

  it('shows the pinned state from the user config', async () => {
    userConfig.pinnedProjectIds = [PROJECT_ID];
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    expect(
      screen.getByRole('button', { name: ButtonsI18nKeys.Unpin }),
    ).toBeTruthy();
  });

  it('downloads the project archive', async () => {
    vi.mocked(downloadProjectArchive).mockResolvedValue(new Response('zip'));
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Download }),
    );

    await waitFor(() =>
      expect(downloadProjectArchive).toHaveBeenCalledWith(PROJECT_ID),
    );
  });

  it('navigates to the edit page from Edit', async () => {
    const { router } = renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Edit }),
    );

    expect(router.state.location.pathname).toBe(
      '/projects/edit/a1b2c3/marketing/q4',
    );
  });

  it('opens the share overlay and the publish panel for the owner', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    await userEvent.click(
      await screen.findByRole('button', { name: ButtonsI18nKeys.Publish }),
    );
    expect(screen.getByRole('dialog', { name: 'publish' }).textContent).toBe(
      PROJECT_ID,
    );

    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Share }),
    );
    expect(screen.getByRole('dialog', { name: 'share' }).textContent).toBe(
      PROJECT_ID,
    );
  });

  it('mounts the publish panel only once it is first opened', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    expect(screen.queryByText('publish panel mounted')).toBeNull();
    await userEvent.click(
      await screen.findByRole('button', { name: ButtonsI18nKeys.Publish }),
    );

    expect(screen.getByRole('dialog', { name: 'publish' })).toBeTruthy();
  });

  describe('unpublish', () => {
    const historyEntry = (folderPath: string) => ({
      entityId: PROJECT_ID,
      entityType: 'project' as never,
      folderPath,
      version: '',
      publishedAt: '2026-11-01T10:00:00Z',
      publishedBy: 'Owner',
    });

    it('shows neither Publish nor Unpublish until the publish state settles', async () => {
      let resolveHistory!: (entries: ReturnType<typeof historyEntry>[]) => void;
      vi.mocked(getCatalogPublishHistory).mockReturnValue(
        new Promise((resolve) => {
          resolveHistory = resolve;
        }),
      );
      renderAt();
      await screen.findByRole('heading', { level: 1, name: 'q4' });

      expect(
        screen.queryByRole('button', { name: ButtonsI18nKeys.Publish }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: ButtonsI18nKeys.Unpublish }),
      ).toBeNull();

      resolveHistory([historyEntry('Organization/Data')]);
      expect(
        await screen.findByRole('button', { name: ButtonsI18nKeys.Unpublish }),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: ButtonsI18nKeys.Publish }),
      ).toBeNull();
    });

    it('offers Publish to the owner of an unpublished project', async () => {
      renderAt();

      expect(
        await screen.findByRole('button', { name: ButtonsI18nKeys.Publish }),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: ButtonsI18nKeys.Unpublish }),
      ).toBeNull();
    });

    it('offers neither to a shared editor', async () => {
      vi.mocked(getProject).mockResolvedValue(
        details({
          source: ProjectSource.Shared,
          canEdit: true,
          canManage: false,
        }),
      );
      renderAt();
      await screen.findByRole('button', { name: ButtonsI18nKeys.Edit });

      expect(
        screen.queryByRole('button', { name: ButtonsI18nKeys.Publish }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: ButtonsI18nKeys.Unpublish }),
      ).toBeNull();
      expect(getCatalogPublishHistory).not.toHaveBeenCalled();
    });

    it('offers Unpublish on a public copy to an administrator', async () => {
      session.user.isAdmin = true;
      vi.mocked(getProject).mockResolvedValue(
        details({
          id: 'projects/public/Data/q4',
          bucket: 'public',
          path: 'Data/q4',
          source: ProjectSource.Organization,
          canEdit: false,
          canManage: false,
        }),
      );
      renderAt('/projects/view/public/Data/q4');

      expect(
        await screen.findByRole('button', { name: ButtonsI18nKeys.Unpublish }),
      ).toBeTruthy();
      expect(getCatalogUnpublishAccess).not.toHaveBeenCalled();
    });

    it('confirms and requests unpublish of the project from its folder', async () => {
      vi.mocked(getCatalogPublishHistory).mockResolvedValue([
        historyEntry('Organization/Data'),
      ]);
      vi.mocked(unpublishCatalogEntity).mockResolvedValue({} as never);
      renderAt();

      await userEvent.click(
        await screen.findByRole('button', { name: ButtonsI18nKeys.Unpublish }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: ProjectsI18nKeys.UnpublishConfirmTitle,
      });
      expect(
        within(dialog).getByText(ProjectsI18nKeys.UnpublishConfirmMessage),
      ).toBeTruthy();
      await userEvent.click(
        within(dialog).getByRole('button', { name: ButtonsI18nKeys.Unpublish }),
      );

      await waitFor(() =>
        expect(unpublishCatalogEntity).toHaveBeenCalledWith(
          'project',
          PROJECT_ID,
          { folderPath: 'Organization/Data' },
        ),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', {
            name: ProjectsI18nKeys.UnpublishConfirmTitle,
          }),
        ).toBeNull(),
      );
    });
  });

  it('deletes after confirmation with the loaded contentVersion and returns to the list', async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);
    const { router } = renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: ButtonsI18nKeys.Delete,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: ButtonsI18nKeys.Delete }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/projects'),
    );
    expect(deleteProject).toHaveBeenCalledWith(PROJECT_ID, '"cv1"');
  });

  it('confirms the delete in a side panel with the catalog copy', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    );
    const drawer = await screen.findByRole('dialog', {
      name: ButtonsI18nKeys.Delete,
    });

    expect(
      within(drawer)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      CatalogI18nKeys.DetailsDeleteConsequenceSharedConfigurations,
      CatalogI18nKeys.DetailsDeleteConsequenceUsersLoseAccess,
      BasicI18nKeys.ConsequenceCannotBeUndone,
    ]);
  });

  it('fills the main column with the project chats', async () => {
    renderAt();

    expect(
      await screen.findByText(`chats of ${PROJECT_ID}, editable: true`),
    ).toBeTruthy();
    expect(
      screen.getByRole('region', { name: ProjectsI18nKeys.ViewMainContent }),
    ).toBeTruthy();
  });

  describe('context file preview', () => {
    const getCanvas = () => screen.getByLabelText('canvas');
    const findCard = () =>
      screen.findByRole('button', { name: ProjectsI18nKeys.ViewOpenFile });

    it('opens a context file in the canvas through the project file locator, not as a download', async () => {
      renderAt();

      await userEvent.click(await findCard());

      await waitFor(() =>
        expect(getCanvas().textContent).toBe(`${PROJECT_ID}::tickets.csv`),
      );
      await waitFor(() =>
        expect(previewResolvers.resolveOoxmlContent).toHaveBeenCalledOnce(),
      );
      expect(
        previewResolvers.resolveOoxmlContent.mock.calls[0][0],
      ).toMatchObject({
        id: 'tickets.csv',
        name: 'tickets.csv',
        url: `${PROJECT_ID}/files/context/tickets.csv`,
      });
      expect(triggerBrowserDownload).not.toHaveBeenCalled();
    });

    it('marks the open file selected', async () => {
      renderAt();
      const card = await findCard();
      expect(card.getAttribute('aria-pressed')).toBe('false');

      await userEvent.click(card);

      await waitFor(() =>
        expect(card.getAttribute('aria-pressed')).toBe('true'),
      );
    });

    it('stacks the Details panel under the chats while a file is open and restores it when the canvas closes', async () => {
      renderAt();
      const card = await findCard();
      const details = screen.getByRole('complementary', {
        name: ProjectsI18nKeys.ViewDetails,
      });
      expect(details.className).toContain('desktop:w-[488px]');

      await userEvent.click(card);
      await waitFor(() =>
        expect(details.className).not.toContain('desktop:w-[488px]'),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'close canvas' }),
      );

      await waitFor(() =>
        expect(details.className).toContain('desktop:w-[488px]'),
      );
    });

    it('closes the canvas when the card of the open file is activated again', async () => {
      renderAt();
      const card = await findCard();

      await userEvent.click(card);
      await waitFor(() =>
        expect(getCanvas().textContent).toBe(`${PROJECT_ID}::tickets.csv`),
      );
      await userEvent.click(card);

      expect(getCanvas().textContent).toBe('closed');
      expect(card.getAttribute('aria-pressed')).toBe('false');
    });

    it('previews a file of a shared read-only project', async () => {
      vi.mocked(getProject).mockResolvedValue(
        details({ canEdit: false, canManage: false }),
      );
      renderAt();

      await userEvent.click(await findCard());

      await waitFor(() =>
        expect(getCanvas().textContent).toBe(`${PROJECT_ID}::tickets.csv`),
      );
    });
  });

  describe('outputs', () => {
    const findOutputs = () =>
      screen.findByRole('region', { name: ProjectsI18nKeys.OutputsTitle });
    const outputs = (...names: string[]) => ({
      items: names.map((name, index) => ({
        name,
        updatedAt: names.length - index,
      })),
    });

    it("renders the project's outputs in the main column, newest first", async () => {
      vi.mocked(listProjectArtifacts).mockResolvedValue(
        outputs('summary.md', 'report.pdf'),
      );
      renderAt();

      const region = await findOutputs();

      expect(listProjectArtifacts).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.any(AbortSignal),
      );
      const cards = within(region).getAllByRole('button', {
        name: ProjectsI18nKeys.ViewOpenFile,
      });
      expect(cards).toHaveLength(2);
      expect(
        within(region).queryByRole('button', { name: /rename|delete/i }),
      ).toBeNull();
    });

    it('renders no Outputs section when the project has none', async () => {
      renderAt();
      await screen.findByText(`chats of ${PROJECT_ID}, editable: true`);
      await waitFor(() => expect(listProjectArtifacts).toHaveBeenCalled());

      expect(
        screen.queryByRole('region', { name: ProjectsI18nKeys.OutputsTitle }),
      ).toBeNull();
      expect(screen.getByText('has outputs: false')).toBeTruthy();
    });

    it('tells the Chats list that outputs are shown, so it drops the empty state', async () => {
      vi.mocked(listProjectArtifacts).mockResolvedValue(outputs('report.pdf'));
      renderAt();

      expect(await screen.findByText('has outputs: true')).toBeTruthy();
    });

    it('announces a failed read and keeps the section and focus through Retry', async () => {
      vi.mocked(listProjectArtifacts)
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValue(outputs('report.pdf'));
      renderAt();

      const region = await findOutputs();
      /* The live region, not the visible aria-hidden copy, carries the announcement. */
      expect(
        screen.getByText(ProjectsI18nKeys.OutputsError, {
          selector: '[role="status"]',
        }),
      ).toBeTruthy();

      await userEvent.click(
        within(region).getByRole('button', { name: ButtonsI18nKeys.Retry }),
      );

      expect(
        await within(region).findByRole('button', {
          name: ProjectsI18nKeys.ViewOpenFile,
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('region', { name: ProjectsI18nKeys.OutputsTitle }),
      ).toBe(region);
      // eslint-disable-next-line testing-library/no-node-access -- Focus has no role query.
      expect(document.activeElement).toBe(
        within(region).getByRole('heading', {
          name: ProjectsI18nKeys.OutputsTitle,
        }),
      );
      expect(listProjectArtifacts).toHaveBeenCalledTimes(2);
    });

    it('shows the outputs of a shared read-only project', async () => {
      vi.mocked(getProject).mockResolvedValue(
        details({ canEdit: false, canManage: false }),
      );
      vi.mocked(listProjectArtifacts).mockResolvedValue(outputs('report.pdf'));
      renderAt();

      expect(await findOutputs()).toBeTruthy();
    });

    it('opens an output in the canvas through the artifact locator and selects only its card', async () => {
      vi.mocked(getProject).mockResolvedValue(
        details({ contextFiles: [{ name: 'report.pdf', size: 10 }] }),
      );
      vi.mocked(listProjectArtifacts).mockResolvedValue(outputs('report.pdf'));
      renderAt();
      const region = await findOutputs();
      const outputCard = within(region).getByRole('button', {
        name: ProjectsI18nKeys.ViewOpenFile,
      });
      const detailsPanel = screen.getByRole('complementary', {
        name: ProjectsI18nKeys.ViewDetails,
      });
      const contextCard = within(detailsPanel).getByRole('button', {
        name: ProjectsI18nKeys.ViewOpenFile,
      });

      await userEvent.click(outputCard);

      await waitFor(() =>
        expect(screen.getByLabelText('canvas').textContent).toBe(
          `${PROJECT_ID}::artifacts/report.pdf`,
        ),
      );
      await waitFor(() =>
        expect(previewResolvers.resolvePdfContent).toHaveBeenCalledOnce(),
      );
      expect(previewResolvers.resolvePdfContent.mock.calls[0][0]).toMatchObject(
        {
          name: 'report.pdf',
          url: `${PROJECT_ID}/files/artifacts/report.pdf`,
        },
      );
      await waitFor(() =>
        expect(outputCard.getAttribute('aria-pressed')).toBe('true'),
      );
      expect(contextCard.getAttribute('aria-pressed')).toBe('false');
      expect(detailsPanel.className).not.toContain('desktop:w-[488px]');
      expect(triggerBrowserDownload).not.toHaveBeenCalled();
    });
  });

  it('reloads the project when a delete loses to a concurrent change', async () => {
    vi.mocked(deleteProject).mockRejectedValue(
      new ResponseError(
        new Response(JSON.stringify({ code: 'project-changed' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: ButtonsI18nKeys.Delete,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: ButtonsI18nKeys.Delete }),
    );

    await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
    expect(showNotificationMock).toHaveBeenCalled();
  });

  describe('live updates', () => {
    /** A watch stream the test feeds. */
    const createWatchStream = () => {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(streamController) {
          controller = streamController;
        },
      });
      return {
        stream,
        send: (event: object) =>
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
          ),
      };
    };

    const renderWatched = async () => {
      const watch = createWatchStream();
      vi.mocked(watchProjects).mockResolvedValue(watch.stream);
      const view = renderAt();
      await screen.findByRole('heading', { level: 1, name: 'q4' });
      /* The chats' silent refresh skips while their first load is pending,
       * so an event sent before it settles would be dropped. */
      await screen.findByText('c1');
      await waitFor(() =>
        expect(watchProjects).toHaveBeenCalledWith(
          [PROJECT_ID],
          expect.objectContaining({ aborted: false }),
        ),
      );
      return { ...view, watch };
    };

    beforeEach(() => {
      vi.mocked(listProjectConversations).mockResolvedValue({
        items: [
          {
            id: `${PROJECT_ID}/conversations/c1`,
            name: 'c1',
            title: 'c1',
            isUnread: false,
          },
        ],
      });
    });

    it('refreshes the details and the chats without a spinner on an update', async () => {
      const { watch } = await renderWatched();
      vi.mocked(getProject).mockResolvedValue(
        details({ description: 'Edited elsewhere', etag: '"e2"' }),
      );
      vi.mocked(listProjectConversations).mockResolvedValue({
        items: [
          {
            id: `${PROJECT_ID}/conversations/c2`,
            name: 'c2',
            title: 'c2',
            isUnread: true,
          },
          {
            id: `${PROJECT_ID}/conversations/c1`,
            name: 'c1',
            title: 'c1',
            isUnread: false,
          },
        ],
      });

      watch.send({
        id: PROJECT_ID,
        action: 'UPDATE',
        timestamp: 1,
        etag: '"e2"',
      });

      expect(await screen.findByText('Edited elsewhere')).toBeTruthy();
      expect(await screen.findByText('c2 (unread)')).toBeTruthy();
      expect(
        screen.getByRole('heading', { level: 1, name: 'q4' }),
      ).toBeTruthy();
    });

    it('shows a new output on an update without a reload', async () => {
      vi.mocked(listProjectArtifacts).mockResolvedValue({
        items: [{ name: 'report.pdf', updatedAt: 1 }],
      });
      const { watch } = await renderWatched();
      const region = await screen.findByRole('region', {
        name: ProjectsI18nKeys.OutputsTitle,
      });
      vi.mocked(getProject).mockResolvedValue(details({ etag: '"e2"' }));
      vi.mocked(listProjectArtifacts).mockResolvedValue({
        items: [
          { name: 'summary.md', updatedAt: 2 },
          { name: 'report.pdf', updatedAt: 1 },
        ],
      });

      watch.send({
        id: PROJECT_ID,
        action: 'UPDATE',
        timestamp: 1,
        etag: '"e2"',
      });

      await waitFor(() =>
        expect(
          within(region).getAllByRole('button', {
            name: ProjectsI18nKeys.ViewOpenFile,
          }),
        ).toHaveLength(2),
      );
      expect(listProjectArtifacts).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole('heading', { level: 1, name: 'q4' }),
      ).toBeTruthy();
    });

    it('keeps the context search query through a refresh', async () => {
      const { watch } = await renderWatched();
      const search = screen.getByRole('textbox', {
        name: ProjectsI18nKeys.ViewContextSearchAriaLabel,
      });
      await userEvent.type(search, 'tick');
      vi.mocked(getProject).mockResolvedValue(details({ etag: '"e2"' }));

      watch.send({
        id: PROJECT_ID,
        action: 'UPDATE',
        timestamp: 1,
        etag: '"e2"',
      });

      await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
      expect(
        (
          screen.getByRole('textbox', {
            name: ProjectsI18nKeys.ViewContextSearchAriaLabel,
          }) as HTMLInputElement
        ).value,
      ).toBe('tick');
    });

    it('skips an update for the version already shown', async () => {
      const { watch } = await renderWatched();

      watch.send({
        id: PROJECT_ID,
        action: 'UPDATE',
        timestamp: 1,
        etag: '"e1"',
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(getProject).toHaveBeenCalledOnce();
    });

    it('announces a delete made elsewhere and returns to the projects list', async () => {
      const { watch, router } = await renderWatched();

      watch.send({ id: PROJECT_ID, action: 'DELETE', timestamp: 2 });

      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/projects'),
      );
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ProjectsI18nKeys.ViewDeletedElsewhere,
        }),
      );
      expect(userConfig.replacePinnedProjectId).toHaveBeenCalledWith(
        PROJECT_ID,
        null,
      );
    });

    it('still leaves on a delete made elsewhere after its own delete failed', async () => {
      const { watch, router } = await renderWatched();
      vi.mocked(deleteProject).mockRejectedValue(
        new ResponseError(new Response(null, { status: 503 })),
      );
      const menu = await openMenu();
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: ButtonsI18nKeys.Delete,
      });
      await userEvent.click(
        within(dialog).getByRole('button', { name: ButtonsI18nKeys.Delete }),
      );
      await waitFor(() => expect(deleteProject).toHaveBeenCalled());

      watch.send({ id: PROJECT_ID, action: 'DELETE', timestamp: 2 });

      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/projects'),
      );
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ProjectsI18nKeys.ViewDeletedElsewhere,
        }),
      );
    });

    it('leaves the page when a refresh finds the project gone', async () => {
      const { watch, router } = await renderWatched();
      vi.mocked(getProject).mockRejectedValue(
        new ResponseError(new Response(null, { status: 404 })),
      );

      watch.send({
        id: PROJECT_ID,
        action: 'UPDATE',
        timestamp: 1,
        etag: '"e2"',
      });

      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/projects'),
      );
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ProjectsI18nKeys.ViewDeletedElsewhere,
        }),
      );
    });

    it('closes the watch when the user leaves the page', async () => {
      const { router } = await renderWatched();
      const signal = vi.mocked(watchProjects).mock.calls[0][1] as AbortSignal;

      await router.navigate('/projects');

      await waitFor(() => expect(signal.aborted).toBe(true));
    });
  });
});
