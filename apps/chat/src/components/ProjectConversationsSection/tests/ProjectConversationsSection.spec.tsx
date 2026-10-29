import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../../constants/translation-keys';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { createDeploymentsContextValue } from '../../../context/tests/deployments-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import {
  createProjectConversation,
  deleteProjectConversation,
  listProjectConversations,
  renameProjectConversation,
  saveProjectConversation,
} from '../../../server-api/project-conversations.api';
import ProjectConversationsSection from '../ProjectConversationsSection';

const { composerMenus } = vi.hoisted(() => ({
  composerMenus: {
    composerProps: {},
    modals: null,
    selectedSkills: [{ id: 'skills/a1b2c3/tone' }],
    resetSkillMentions: vi.fn(),
    seedSkillMentions: vi.fn(),
  },
}));

vi.mock('../../../hooks/conversation/useComposerMenus', () => ({
  useComposerMenus: () => composerMenus,
}));
vi.mock('../../../context/DeploymentsContext');
vi.mock('../../../context/NotificationContext');
vi.mock('../../DeploymentSelector/useDeploymentSelectorOverlay', () => ({
  useDeploymentSelectorOverlay: () => ({
    renderOverlay: () => null,
    catalogModal: null,
  }),
}));
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>()),
  useToolsMenu: () => ({
    toolsMenuItems: [],
    onToolToggle: vi.fn(),
    toolConfigurationValue: undefined,
  }),
}));
/* The composer is the new-conversation screen's own component; a stand-in sends one message. */
vi.mock('../../NewConversationComposer/NewConversationComposer', () => ({
  default: ({
    placeholder,
    onCreateConversation,
  }: {
    placeholder: string;
    onCreateConversation: (
      message: string,
      attachments: unknown[],
      settings: Record<string, unknown>,
    ) => Promise<void>;
  }) => (
    <button
      type="button"
      onClick={() => {
        onCreateConversation('Draft an article', [], {
          systemPrompt: 'Be brief',
          temperature: 0.5,
        }).catch(() => undefined);
      }}
    >
      {placeholder}
    </button>
  ),
}));
vi.mock('../../../server-api/project-conversations.api', () => ({
  listProjectConversations: vi.fn(),
  createProjectConversation: vi.fn(),
  saveProjectConversation: vi.fn(),
  renameProjectConversation: vi.fn(),
  deleteProjectConversation: vi.fn(),
}));

const PROJECT_ID = 'projects/a1b2c3/q4';
const CHAT_ID = `${PROJECT_ID}/conversations/gpt-4o__Old__1`;
const showNotification = vi.fn();
const restoreDefaultSelection = vi.fn();

const renderSection = (canEdit = true) => {
  const router = createMemoryRouter(
    [
      {
        path: '/projects/view/:bucket/*',
        element: (
          <ProjectConversationsSection
            projectId={PROJECT_ID}
            projectName="Q4 launch"
            canEdit={canEdit}
          />
        ),
      },
      { path: '/projects/chat/:bucket/*', element: <p>project chat</p> },
    ],
    { initialEntries: ['/projects/view/a1b2c3/q4'] },
  );
  render(<RouterProvider router={router} />);
  return { router };
};

describe('ProjectConversationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotification).mockReturnValue(
      createNotificationContextValue(showNotification),
    );
    vi.mocked(useDeployments).mockReturnValue(
      createDeploymentsContextValue({
        selectedItemId: 'gpt-4o',
        restoreDefaultSelection,
      }),
    );
    vi.mocked(listProjectConversations).mockResolvedValue({
      items: [{ id: CHAT_ID, name: 'gpt-4o__Old__1', title: 'Old title' }],
      hasMore: false,
    });
  });

  it('opens the new chat after the first message', async () => {
    const created = { id: `${PROJECT_ID}/conversations/gpt-4o__Draft__2` };
    vi.mocked(createProjectConversation).mockResolvedValue(created as never);
    vi.mocked(saveProjectConversation).mockResolvedValue(created as never);
    const { router } = renderSection();

    await userEvent.click(
      screen.getByRole('button', {
        name: ProjectsI18nKeys.ChatsInputPlaceholder,
      }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/projects/chat/a1b2c3/q4/conversations/gpt-4o__Draft__2',
      ),
    );
    expect(createProjectConversation).toHaveBeenCalledWith(
      PROJECT_ID,
      'Draft an article',
      'gpt-4o',
      undefined,
      undefined,
      undefined,
      [{ id: 'skills/a1b2c3/tone' }],
    );
    expect(composerMenus.resetSkillMentions).toHaveBeenCalledOnce();
    expect(saveProjectConversation).toHaveBeenCalledWith(
      created.id,
      expect.objectContaining({ prompt: 'Be brief', temperature: 0.5 }),
    );
    expect(restoreDefaultSelection).toHaveBeenCalled();
  });

  it('reports a full project and stays on the page', async () => {
    vi.mocked(createProjectConversation).mockRejectedValue(
      new ResponseError(
        new Response(JSON.stringify({ code: 'project-storage-full' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const { router } = renderSection();

    await userEvent.click(
      screen.getByRole('button', {
        name: ProjectsI18nKeys.ChatsInputPlaceholder,
      }),
    );

    await waitFor(() =>
      expect(showNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: ProjectsI18nKeys.ChatsStorageFull }),
      ),
    );
    expect(router.state.location.pathname).toBe('/projects/view/a1b2c3/q4');
    expect(composerMenus.seedSkillMentions).toHaveBeenCalledWith(
      'Draft an article',
      [{ id: 'skills/a1b2c3/tone' }],
    );
  });

  it('shows the chats without the input or row menus when read-only', async () => {
    renderSection(false);

    expect(
      await screen.findByRole('button', {
        name: ProjectsI18nKeys.ChatsOpenLabelNoAuthor,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: ProjectsI18nKeys.ChatsInputPlaceholder,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: ProjectsI18nKeys.ChatsMoreActions }),
    ).toBeNull();
  });

  it('shows the empty state', async () => {
    vi.mocked(listProjectConversations).mockResolvedValue({
      items: [],
      hasMore: false,
    });
    renderSection();

    expect(await screen.findByText(ProjectsI18nKeys.ChatsEmpty)).toBeTruthy();
    expect(
      screen.getByText(ProjectsI18nKeys.ChatsEmptyDescription),
    ).toBeTruthy();
  });

  it('renames a chat from its row menu', async () => {
    vi.mocked(renameProjectConversation).mockResolvedValue({
      name: 'Login article',
    });
    renderSection();

    await userEvent.click(
      await screen.findByRole('button', {
        name: ProjectsI18nKeys.ChatsMoreActions,
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: ButtonsI18nKeys.Rename }),
    );
    const input = await screen.findByLabelText(
      ProjectsI18nKeys.ChatsRenameInputLabel,
    );
    await userEvent.clear(input);
    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Save }),
    );
    expect(
      await screen.findByText(ProjectsI18nKeys.ChatsRenameEmpty),
    ).toBeTruthy();
    expect(renameProjectConversation).not.toHaveBeenCalled();

    await userEvent.type(input, ' Login article ');
    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Save }),
    );

    await waitFor(() =>
      expect(renameProjectConversation).toHaveBeenCalledWith(
        CHAT_ID,
        'Login article',
      ),
    );
  });

  it('returns focus to the row menu trigger when the delete dialog is cancelled', async () => {
    renderSection();

    const trigger = await screen.findByRole('button', {
      name: ProjectsI18nKeys.ChatsMoreActions,
    });
    await userEvent.click(trigger);
    await userEvent.click(
      await screen.findByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    );
    await screen.findByRole('dialog', {
      name: ProjectsI18nKeys.ChatsDeleteConfirmTitle,
    });
    await userEvent.click(
      screen.getByRole('button', { name: ButtonsI18nKeys.Cancel }),
    );

    // eslint-disable-next-line testing-library/no-node-access -- focus restoration has no query; the focused element is the assertion
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('deletes a chat after confirmation', async () => {
    vi.mocked(deleteProjectConversation).mockResolvedValue(undefined);
    renderSection();

    await userEvent.click(
      await screen.findByRole('button', {
        name: ProjectsI18nKeys.ChatsMoreActions,
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: ButtonsI18nKeys.Delete }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: ProjectsI18nKeys.ChatsDeleteConfirmTitle,
    });
    await userEvent.click(
      screen.getAllByRole('button', { name: ButtonsI18nKeys.Delete }).at(-1) ??
        dialog,
    );

    await waitFor(() =>
      expect(deleteProjectConversation).toHaveBeenCalledWith(CHAT_ID),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: ProjectsI18nKeys.ChatsOpenLabelNoAuthor,
        }),
      ).toBeNull(),
    );
  });
});
