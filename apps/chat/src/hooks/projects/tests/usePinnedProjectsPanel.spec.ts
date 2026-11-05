import {
  ProjectSource,
  ResponseError,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PinnedProjectActionKind } from '../../../types/pinned-project-action';
import { usePinnedProjectsPanel } from '../usePinnedProjectsPanel';

const P = 'projects/bucket/support';
const C1 = `${P}/conversations/c1`;
const C2 = `${P}/conversations/c2`;

const mocks = vi.hoisted(() => ({
  isEnabled: true,
  pinnedProjectIds: [] as string[],
  setPinnedProject: vi.fn(),
  replacePinnedProjectId: vi.fn(),
  showErrorNotification: vi.fn(),
  viewedListeners: new Set<(id: string) => void>(),
  client: {
    getProject: vi.fn(),
    listProjectConversations: vi.fn(),
    getProjectConversationTitles: vi.fn(),
    watchProjects: vi.fn(),
  },
}));

vi.mock('../projects-client', () => ({
  projectsClient: mocks.client,
  subscribeProjectConversationViewed: (listener: (id: string) => void) => {
    mocks.viewedListeners.add(listener);
    return () => mocks.viewedListeners.delete(listener);
  },
}));
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) =>
    key === 'projectsEnabled' ? mocks.isEnabled : false,
}));
vi.mock('../../../context/UserConfigContext', () => ({
  useUserConfig: () => ({
    pinnedProjectIds: mocks.pinnedProjectIds,
    setPinnedProject: mocks.setPinnedProject,
    replacePinnedProjectId: mocks.replacePinnedProjectId,
  }),
}));
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({
    showErrorNotification: mocks.showErrorNotification,
  }),
}));
const translation = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => translation }));

const details = (
  overrides: Partial<ProjectDetailsDto> = {},
): ProjectDetailsDto => ({
  id: P,
  name: 'Support',
  bucket: 'bucket',
  path: 'support',
  source: ProjectSource.Personal,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"a1"',
  contentVersion: 'v1',
  conversationCount: 2,
  canEdit: true,
  canManage: true,
  ...overrides,
});

const listing = (count = 2) => ({
  items: Array.from({ length: count }, (_, index) => ({
    id: `${P}/conversations/c${index + 1}`,
    name: `c${index + 1}`,
    title: `Chat ${index + 1}`,
    updatedAt: 100,
    isUnread: true,
  })),
});

const renderPanel = (path = '/', onOpenRoute = vi.fn()) => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [path] }, children);
  const view = renderHook(() => usePinnedProjectsPanel(onOpenRoute), {
    wrapper,
  });
  return { ...view, onOpenRoute };
};

const loadedProjects = async (result: {
  current: ReturnType<typeof usePinnedProjectsPanel>;
}) => {
  await waitFor(() =>
    expect(result.current.pinnedProjects?.projects).toHaveLength(1),
  );
  const pinned = result.current.pinnedProjects;
  if (pinned == null) throw new Error('No pinned projects');
  return pinned;
};

/* Clicks a real button so the item's onClick gets the React event the menu would pass. */
const clickItem = (items: DropdownItem[], key: string) => {
  const onClick = items.find((item) => item.key === key)?.onClick;
  if (onClick == null) throw new Error(`No clickable "${key}" item`);
  const { unmount } = render(
    createElement(
      'button',
      { type: 'button', onClick: (domEvent) => onClick({ key, domEvent }) },
      key,
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: key }));
  unmount();
};

describe('usePinnedProjectsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEnabled = true;
    mocks.pinnedProjectIds = [P];
    mocks.viewedListeners.clear();
    mocks.client.getProject.mockResolvedValue(details());
    mocks.client.listProjectConversations.mockResolvedValue(listing());
    mocks.client.getProjectConversationTitles.mockResolvedValue({ items: [] });
    mocks.client.watchProjects.mockReturnValue(new Promise(() => undefined));
    mocks.setPinnedProject.mockResolvedValue(undefined);
  });

  describe('tree', () => {
    it('maps each pinned project to a group with its routes and origin', async () => {
      mocks.client.getProject.mockResolvedValue(
        details({ source: ProjectSource.Shared }),
      );
      const { result } = renderPanel();

      const [group] = (await loadedProjects(result)).projects;
      expect(group).toEqual({
        id: P,
        name: 'Support',
        href: '/projects/view/bucket/support',
        source: FilterTab.Shared,
        hasMore: false,
        conversations: [
          {
            id: C1,
            title: 'Chat 1',
            href: '/projects/chat/bucket/support/conversations/c1',
            isUnread: true,
          },
          {
            id: C2,
            title: 'Chat 2',
            href: '/projects/chat/bucket/support/conversations/c2',
            isUnread: true,
          },
        ],
      });
    });

    it('sends no request and passes no trees with projects off', () => {
      mocks.isEnabled = false;
      const { result } = renderPanel();

      expect(result.current.pinnedProjects).toBeUndefined();
      expect(mocks.client.getProject).not.toHaveBeenCalled();
      expect(mocks.client.listProjectConversations).not.toHaveBeenCalled();
      expect(mocks.client.watchProjects).not.toHaveBeenCalled();
    });

    it('unpins a project that no longer exists', async () => {
      mocks.client.getProject.mockRejectedValue(
        new ResponseError(new Response('{}', { status: 404 })),
      );
      renderPanel();

      await waitFor(() =>
        expect(mocks.setPinnedProject).toHaveBeenCalledWith(P, false),
      );
      expect(mocks.replacePinnedProjectId).not.toHaveBeenCalled();
    });

    it('drops the pin locally when unpinning a project that no longer exists fails', async () => {
      mocks.client.getProject.mockRejectedValue(
        new ResponseError(new Response('{}', { status: 404 })),
      );
      mocks.setPinnedProject.mockRejectedValue(new Error('offline'));
      renderPanel();

      await waitFor(() =>
        expect(mocks.replacePinnedProjectId).toHaveBeenCalledWith(P, null),
      );
      expect(mocks.showErrorNotification).not.toHaveBeenCalled();
    });

    it('opens a nested chat and clears its dot at once', async () => {
      const { result, onOpenRoute } = renderPanel();
      const pinned = await loadedProjects(result);

      act(() => pinned.onSelectConversation(C1, P));

      expect(onOpenRoute).toHaveBeenCalledWith(
        '/projects/chat/bucket/support/conversations/c1',
      );
      expect(
        result.current.pinnedProjects?.projects[0].conversations[0].isUnread,
      ).toBeUndefined();
    });

    it('opens the project view from the project row and from See all', async () => {
      const { result, onOpenRoute } = renderPanel();
      const pinned = await loadedProjects(result);

      pinned.onSelectProject(P);
      pinned.onSeeAll(P);

      expect(onOpenRoute).toHaveBeenNthCalledWith(
        1,
        '/projects/view/bucket/support',
      );
      expect(onOpenRoute).toHaveBeenNthCalledWith(
        2,
        '/projects/view/bucket/support',
      );
    });

    it('reports the open project chat as active and shows it read', async () => {
      const { result } = renderPanel(
        '/projects/chat/bucket/support/conversations/c1',
      );
      const [group] = (await loadedProjects(result)).projects;

      expect(result.current.activeConversationId).toBe(C1);
      expect(group.conversations[0].isUnread).toBeUndefined();
      expect(group.conversations[1].isUnread).toBe(true);
      expect(result.current.actionOverlay.routeProjectId).toBe(P);
    });

    it('marks the project active on its view and edit pages', async () => {
      const view = renderPanel('/projects/view/bucket/support');
      expect((await loadedProjects(view.result)).activeProjectId).toBe(P);
      view.unmount();

      const { result: editResult } = renderPanel(
        '/projects/edit/bucket/support',
      );
      expect((await loadedProjects(editResult)).activeProjectId).toBe(P);
      expect(editResult.current.activeConversationId).toBeUndefined();
    });

    it('keeps its trees object across a render with nothing changed', async () => {
      const { result, rerender } = renderPanel();
      const pinned = await loadedProjects(result);

      rerender();

      expect(result.current.pinnedProjects).toBe(pinned);
    });
  });

  describe('read state', () => {
    it('clears the dot of a chat read on the project page', async () => {
      const { result } = renderPanel();
      await loadedProjects(result);
      expect(mocks.viewedListeners.size).toBe(1);

      act(() => {
        for (const listener of mocks.viewedListeners) listener(C2);
      });

      const [first, second] =
        result.current.pinnedProjects?.projects[0].conversations ?? [];
      expect(first.isUnread).toBe(true);
      expect(second.isUnread).toBeUndefined();
    });

    it('unsubscribes on unmount', async () => {
      const { result, unmount } = renderPanel();
      await loadedProjects(result);

      unmount();

      expect(mocks.viewedListeners.size).toBe(0);
    });

    it('does not subscribe with projects off', () => {
      mocks.isEnabled = false;
      renderPanel();

      expect(mocks.viewedListeners.size).toBe(0);
    });
  });

  describe('actions', () => {
    const actionsOf = async (result: {
      current: ReturnType<typeof usePinnedProjectsPanel>;
    }) => {
      const pinned = await loadedProjects(result);
      return pinned.getActions?.(pinned.projects[0]) ?? [];
    };

    it('offers the owner Unpin, Edit, Publish, Share and Delete in that order', async () => {
      const { result } = renderPanel();

      const items = await actionsOf(result);

      expect(items.map(({ key }) => key)).toEqual([
        'unpin',
        'edit',
        'publish',
        'share',
        'delete',
      ]);
      expect(items.map(({ label }) => label)).toEqual([
        'buttons.unpin',
        'buttons.edit',
        'buttons.publish',
        'buttons.share',
        'buttons.delete',
      ]);
    });

    it('offers a share recipient with edit access Unpin and Edit', async () => {
      mocks.client.getProject.mockResolvedValue(
        details({
          canEdit: true,
          canManage: false,
          source: ProjectSource.Shared,
        }),
      );
      const { result } = renderPanel();

      expect((await actionsOf(result)).map(({ key }) => key)).toEqual([
        'unpin',
        'edit',
      ]);
    });

    it('offers a view-only share recipient Unpin only', async () => {
      mocks.client.getProject.mockResolvedValue(
        details({
          canEdit: false,
          canManage: false,
          source: ProjectSource.Shared,
        }),
      );
      const { result } = renderPanel();

      expect((await actionsOf(result)).map(({ key }) => key)).toEqual([
        'unpin',
      ]);
    });

    it('removes the tree on Unpin', async () => {
      mocks.setPinnedProject.mockImplementation(async () => {
        mocks.pinnedProjectIds = [];
      });
      const { result, rerender } = renderPanel();
      const items = await actionsOf(result);

      clickItem(items, 'unpin');
      await waitFor(() =>
        expect(mocks.setPinnedProject).toHaveBeenCalledWith(P, false),
      );
      rerender();

      await waitFor(() =>
        expect(result.current.pinnedProjects?.projects).toEqual([]),
      );
    });

    it('shows the pin error when Unpin fails', async () => {
      mocks.setPinnedProject.mockRejectedValue(new Error('offline'));
      const { result } = renderPanel();
      const items = await actionsOf(result);

      clickItem(items, 'unpin');

      await waitFor(() =>
        expect(mocks.showErrorNotification).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'projects.actions.pinError' }),
        ),
      );
    });

    it('opens the edit page through the route opener', async () => {
      const { result, onOpenRoute } = renderPanel();
      const items = await actionsOf(result);

      clickItem(items, 'edit');

      expect(onOpenRoute).toHaveBeenCalledWith('/projects/edit/bucket/support');
    });

    it.each([
      ['publish', PinnedProjectActionKind.Publish],
      ['share', PinnedProjectActionKind.Share],
      ['delete', PinnedProjectActionKind.Delete],
    ])('opens the %s overlay for the project', async (key, kind) => {
      const { result } = renderPanel();
      const pinned = await loadedProjects(result);
      const trigger = document.createElement('button');
      act(() => pinned.onActionMenuOpen?.(pinned.projects[0], trigger));
      const items = pinned.getActions?.(pinned.projects[0]) ?? [];

      clickItem(items, key);

      expect(result.current.actionOverlay.action).toEqual({
        kind,
        projectId: P,
        isOpen: true,
      });
      expect(result.current.actionOverlay.project).toEqual(details());
      expect(result.current.actionOverlay.returnFocusRef.current).toBe(trigger);

      act(() => result.current.actionOverlay.onClose());

      expect(result.current.actionOverlay.action).toEqual({
        kind,
        projectId: P,
        isOpen: false,
      });
    });
  });
});
