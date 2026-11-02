import { ProjectSource } from '@epam/ai-dial-chat-api-client';
import { useIsMobile } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotFoundI18nKeys,
  ProjectsI18nKeys,
} from '../../../constants/translation-keys';
import { ChatLayoutHeaderSlotContext } from '../../../context/ChatLayoutHeaderSlotContext';
import { useConversationDataSource } from '../../../context/ConversationDataSourceContext';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { getProject } from '../../../server-api/projects.api';
import ProjectChatPage from '../ProjectChatPage';

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);
vi.mock('../../../server-api/projects.api', () => ({ getProject: vi.fn() }));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  useIsMobile: vi.fn(() => false),
}));
vi.mock('../../../context/ConversationsContext', () => ({
  useConversations: () => ({}),
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { bucket: 'a1b2c3' } }),
}));
/* The page under test hosts the conversation; the conversation page itself is covered elsewhere. */
vi.mock('../../Conversation/Conversation', () => ({
  ConversationPage: ({ conversationId }: { conversationId?: string }) => {
    const source = useConversationDataSource();
    return (
      <p>
        {`conversation ${conversationId} read-only:${String(source.isReadOnly(conversationId ?? ''))} duplicate:${String(source.canDuplicate)} exit:${source.getExitRoute()}`}
      </p>
    );
  },
}));

const project = (canEdit: boolean, bucket = 'a1b2c3') => ({
  id: `projects/${bucket}/q4`,
  name: 'Q4 launch',
  bucket,
  path: 'q4',
  source: canEdit ? ProjectSource.Personal : ProjectSource.Shared,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 1,
  canEdit,
});

/* Stands in for `ChatLayout`: a top bar whose start cell is offered to the page. */
const LayoutWithHeaderSlot = () => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <>
      <header aria-label="layout bar" ref={setSlot} />
      <ChatLayoutHeaderSlotContext.Provider value={slot}>
        <ProjectChatPage />
      </ChatLayoutHeaderSlotContext.Provider>
    </>
  );
};

const renderAt = (
  path = '/projects/chat/a1b2c3/q4/conversations/x',
  state?: unknown,
  { inLayout = false }: { inLayout?: boolean } = {},
) => {
  const router = createMemoryRouter(
    [
      {
        path: '/projects/chat/:bucket/*',
        element: inLayout ? <LayoutWithHeaderSlot /> : <ProjectChatPage />,
      },
      { path: '/projects/view/:bucket/*', element: <p>project view</p> },
      { path: '/projects', element: <p>projects list</p> },
    ],
    { initialEntries: [{ pathname: path, state }] },
  );
  render(<RouterProvider router={router} />);
  return { router };
};

describe('ProjectChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIsMobile).mockReturnValue(false);
    document.documentElement.dir = 'ltr';
    useAppConfigMock.mockReturnValue({ status: 'ready', config: {} });
    useFeatureFlagMock.mockReturnValue(true);
    vi.mocked(getProject).mockResolvedValue(project(true));
  });

  it('renders the not-found page when projects are disabled', () => {
    useFeatureFlagMock.mockReturnValue(false);

    renderAt();

    expect(screen.getByText(NotFoundI18nKeys.Title)).toBeTruthy();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('renders the project not-found state for a route without a conversation', async () => {
    renderAt('/projects/chat/a1b2c3/q4');

    expect(screen.getByText(ProjectsI18nKeys.ViewNotFound)).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: ProjectsI18nKeys.ViewBrowseProjects }),
    );
    expect(await screen.findByText('projects list')).toBeTruthy();
  });

  it('hosts the conversation with the project data source', async () => {
    renderAt();

    expect(
      await screen.findByText(
        'conversation projects/a1b2c3/q4/conversations/x read-only:false duplicate:false exit:/projects/view/a1b2c3/q4',
      ),
    ).toBeTruthy();
    expect(getProject).toHaveBeenCalledWith(
      'projects/a1b2c3/q4',
      expect.anything(),
    );
  });

  it('hosts the conversation from the opening page project before the details load', () => {
    vi.mocked(getProject).mockReturnValue(new Promise(() => undefined));

    renderAt(undefined, {
      project: { id: 'projects/a1b2c3/q4', name: 'Q4 launch', canEdit: true },
    });

    expect(
      screen.getByText(
        'conversation projects/a1b2c3/q4/conversations/x read-only:false duplicate:false exit:/projects/view/a1b2c3/q4',
      ),
    ).toBeTruthy();
  });

  it('ignores a navigation project of another project', () => {
    vi.mocked(getProject).mockReturnValue(new Promise(() => undefined));

    renderAt(undefined, {
      project: { id: 'projects/a1b2c3/other', name: 'Other', canEdit: true },
    });

    expect(screen.queryByText(/^conversation /)).toBeNull();
  });

  it('renders the breadcrumb in the layout top bar on desktop', async () => {
    renderAt(undefined, undefined, { inLayout: true });

    const bar = screen.getByRole('banner', { name: 'layout bar' });
    expect(
      await within(bar).findByRole('link', { name: 'Q4 launch' }),
    ).toBeTruthy();
  });

  it('keeps the breadcrumb on the page on mobile', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    renderAt(undefined, undefined, { inLayout: true });

    expect(await screen.findByRole('link', { name: 'Q4 launch' })).toBeTruthy();
    expect(
      within(screen.getByRole('banner', { name: 'layout bar' })).queryByRole(
        'link',
      ),
    ).toBeNull();
  });

  it('opens a shared project conversation read-only', async () => {
    vi.mocked(getProject).mockResolvedValue(project(false, 'z9y8x7'));

    renderAt('/projects/chat/z9y8x7/q4/conversations/x');

    expect(
      await screen.findByText(/read-only:true duplicate:false/),
    ).toBeTruthy();
  });

  it('goes back to the project from the breadcrumb', async () => {
    const { router } = renderAt();

    await userEvent.click(
      await screen.findByRole('button', {
        name: ProjectsI18nKeys.ChatBackToProject,
      }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/projects/view/a1b2c3/q4'),
    );
  });

  it('mirrors the back arrow and keeps logical layout in RTL', async () => {
    document.documentElement.dir = 'rtl';

    renderAt();

    const back = await screen.findByRole('button', {
      name: ProjectsI18nKeys.ChatBackToProject,
    });
    // eslint-disable-next-line testing-library/no-node-access -- the RTL mirror is a CSS class on the decorative icon, which no query reaches
    expect(back.querySelector('svg')?.getAttribute('class')).toContain(
      'rtl:scale-x-[-1]',
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/projects/view/a1b2c3/q4',
    );
  });
});
