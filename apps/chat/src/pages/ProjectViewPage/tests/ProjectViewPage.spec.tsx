import {
  ProjectSource,
  ResponseError,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  NotFoundI18nKeys,
  ProjectsI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  deleteProject,
  downloadProjectArchive,
  getProject,
} from '../../../server-api/projects.api';
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
  downloadProjectContextFile: vi.fn(),
}));
vi.mock('../../../utils/file-download', () => ({
  triggerBrowserDownload: vi.fn(
    async (_response: Response, name: string) => name,
  ),
}));
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
  canEdit: true,
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
  render(<RouterProvider router={router} />);
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
      details({ source: ProjectSource.Shared, canEdit: false }),
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
      screen
        .getByRole('button', { name: ButtonsI18nKeys.Pin })
        .getAttribute('aria-pressed'),
    ).toBe('true');
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

  it('opens the view-only share overlay and the publish panel', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Publish }),
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
      screen.getByRole('button', { name: ButtonsI18nKeys.Publish }),
    );

    expect(screen.getByRole('dialog', { name: 'publish' })).toBeTruthy();
  });

  it('makes the page behind the share overlay inert', async () => {
    renderAt();
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'q4',
    });
    // eslint-disable-next-line testing-library/no-node-access -- `inert` has no role-level query
    expect(heading.closest('[inert]')).toBeNull();

    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Share }),
    );

    // eslint-disable-next-line testing-library/no-node-access -- see above
    expect(heading.closest('[inert]')).toBeTruthy();
    const shareDialog = screen.getByRole('dialog', { name: 'share' });
    // eslint-disable-next-line testing-library/no-node-access -- see above
    expect(shareDialog.closest('[inert]')).toBeNull();
  });

  it('deletes after confirmation with the loaded ETag and returns to the list', async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined);
    const { router } = renderAt();
    await screen.findByRole('heading', { level: 1, name: 'q4' });

    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: ProjectsI18nKeys.ActionsDeleteConfirmTitle,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: ButtonsI18nKeys.Delete }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/projects'),
    );
    expect(deleteProject).toHaveBeenCalledWith(PROJECT_ID, '"e1"');
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
      name: ProjectsI18nKeys.ActionsDeleteConfirmTitle,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: ButtonsI18nKeys.Delete }),
    );

    await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
    expect(showNotificationMock).toHaveBeenCalled();
  });
});
