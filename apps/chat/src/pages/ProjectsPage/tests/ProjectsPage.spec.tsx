import { ProjectSource as ProjectSourceDto } from '@epam/ai-dial-chat-api-client';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotFoundI18nKeys,
  ProjectsI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { listProjects } from '../../../server-api/projects.api';
import ProjectsPage from '../ProjectsPage';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

vi.mock('../../../server-api/projects.api', () => ({
  listProjects: vi.fn(),
}));

const userConfig = vi.hoisted(() => ({ pinnedProjectIds: [] as string[] }));
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => userConfig,
}));

const listing = {
  items: [
    {
      id: 'projects/b/q4-launch',
      name: 'Q4 Launch',
      bucket: 'b',
      path: 'q4-launch',
      source: ProjectSourceDto.Personal,
      updatedAt: Date.UTC(2026, 0, 1),
    },
    {
      id: 'projects/public/handbook',
      name: 'Handbook',
      bucket: 'public',
      path: 'handbook',
      source: ProjectSourceDto.Organization,
    },
  ],
  incompleteSources: [],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/projects']}>
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<p>New project form</p>} />
        <Route path="/projects/view/:bucket/*" element={<p>Project view</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userConfig.pinnedProjectIds = [];
    useAppConfigMock.mockReturnValue({ status: 'ready' });
    vi.mocked(listProjects).mockResolvedValue(listing);
  });

  it('renders NotFound and requests no projects when projectsEnabled is off', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderPage();

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('renders neither NotFound nor projects while the app config is loading', () => {
    useAppConfigMock.mockReturnValue({ status: 'loading' });
    useFeatureFlagMock.mockReturnValue(false);
    renderPage();

    expect(
      screen.queryByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeNull();
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('lists the loaded projects with their translated source labels', async () => {
    useFeatureFlagMock.mockImplementation(
      (key?: string) => key === 'projectsEnabled',
    );
    renderPage();

    const cards = await screen.findAllByRole('article');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: ProjectsI18nKeys.PageTitle,
      }),
    ).toBeTruthy();
    expect(cards).toHaveLength(2);
    expect(
      within(screen.getByRole('article', { name: 'Q4 Launch' })).getByText(
        ProjectsI18nKeys.SourcePersonal,
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Handbook' })).getByText(
        ProjectsI18nKeys.SourceOrganization,
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Q4 Launch' })).getByRole(
        'time',
      ),
    ).toBeTruthy();
  });

  it('filters the list as the user types in the search', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderPage();
    await screen.findAllByRole('article');

    await userEvent.type(
      screen.getByRole('textbox', { name: ProjectsI18nKeys.SearchAriaLabel }),
      'hand',
    );

    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('tells the user the list is incomplete instead of claiming there are no projects', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    vi.mocked(listProjects).mockResolvedValue({
      items: [],
      incompleteSources: [ProjectSourceDto.Personal],
    });
    renderPage();

    expect(
      await screen.findByText(ProjectsI18nKeys.IncompleteLabel, {
        selector: 'p',
      }),
    ).toBeTruthy();
    expect(screen.queryByText(ProjectsI18nKeys.EmptyStateLabel)).toBeNull();
    expect(screen.getByRole('button', { name: 'buttons.retry' })).toBeTruthy();
  });

  it('shows the error state and reloads the projects on retry', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    vi.mocked(listProjects)
      .mockRejectedValueOnce(new Error('Bad gateway'))
      .mockResolvedValueOnce(listing);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'buttons.retry' }),
    );

    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  it('opens the New project page from the header button', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {
        name: ProjectsI18nKeys.PageNewProject,
      }),
    );

    expect(await screen.findByText('New project form')).toBeTruthy();
  });

  it('opens the New project page from the empty state', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    vi.mocked(listProjects).mockResolvedValue({
      items: [],
      incompleteSources: [],
    });
    renderPage();

    await screen.findAllByText(ProjectsI18nKeys.EmptyStateLabel);
    const buttons = screen.getAllByRole('button', {
      name: ProjectsI18nKeys.PageNewProject,
    });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);

    expect(await screen.findByText('New project form')).toBeTruthy();
  });

  it('lists pinned projects first and marks them', async () => {
    userConfig.pinnedProjectIds = ['projects/public/handbook'];
    vi.mocked(listProjects).mockResolvedValue(listing);
    useFeatureFlagMock.mockReturnValue(true);
    renderPage();

    const cards = await screen.findAllByRole('article');
    expect(cards[0].getAttribute('aria-label')).toBe('Handbook');
    expect(
      within(cards[0]).getByText(ProjectsI18nKeys.CardPinned),
    ).toBeTruthy();
  });

  it('opens a project from its card', async () => {
    vi.mocked(listProjects).mockResolvedValue(listing);
    useFeatureFlagMock.mockReturnValue(true);
    renderPage();

    const link = await screen.findByRole('link', { name: 'Handbook' });
    expect(link.getAttribute('href')).toBe('/projects/view/public/handbook');
    await userEvent.click(link);

    expect(await screen.findByText('Project view')).toBeTruthy();
  });
});
