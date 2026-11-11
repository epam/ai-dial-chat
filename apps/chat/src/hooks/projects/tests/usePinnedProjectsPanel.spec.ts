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
import { getShareRecipientsCount } from '../../../server-api/share.api';
import { PinnedProjectActionKind } from '../../../types/pinned-project-action';
import { StorageKey } from '../../../types/storage-key';
import { UserConfigStatus } from '../../../types/user-config-status';
import { usePinnedProjectsPanel } from '../usePinnedProjectsPanel';
import { notifyProjectAccessRevoked } from '../useProjectShareRecipients';

vi.mock('../../../server-api/share.api', () => ({
  getShareRecipientsCount: vi.fn(async () => ({
    itemId: 'projects/owner/q4',
    recipientsCount: 1,
  })),
}));

const P = 'projects/bucket/support';
const C1 = `${P}/conversations/c1`;
const C2 = `${P}/conversations/c2`;

const mocks = vi.hoisted(() => ({
  isEnabled: true,
  pinnedProjectIds: [] as string[],
  status: 'ready' as string,
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
    status: mocks.status,
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
    vi.mocked(getShareRecipientsCount).mockResolvedValue({
      itemId: P,
      recipientsCount: 1,
    });
    mocks.isEnabled = true;
    mocks.pinnedProjectIds = [P];
    mocks.status = UserConfigStatus.Ready;
    localStorage.clear();
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
        isExpanded: true,
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

      expect((await actionsOf(result)).map((item) => item.key)).not.toContain(
        'revokeAccess',
      );
      const pinned = await loadedProjects(result);
      await act(async () =>
        pinned.onActionMenuOpen?.(
          pinned.projects[0],
          document.createElement('button'),
        ),
      );

      const items = await actionsOf(result);

      expect(items.map(({ key }) => key)).toEqual([
        'unpin',
        'edit',
        'publish',
        'share',
        'revokeAccess',
        'delete',
      ]);
      expect(items.map(({ label }) => label)).toEqual([
        'buttons.unpin',
        'buttons.edit',
        'buttons.publish',
        'buttons.share',
        'buttons.revokeAccess',
        'buttons.delete',
      ]);
    });

    it('hides revoke after access is revoked and after a zero-recipient lookup', async () => {
      const { result } = renderPanel();
      await actionsOf(result);
      act(() => notifyProjectAccessRevoked(P));
      expect((await actionsOf(result)).map((item) => item.key)).not.toContain(
        'revokeAccess',
      );
      vi.mocked(getShareRecipientsCount).mockResolvedValue({
        itemId: 'projects/owner/q4',
        recipientsCount: 0,
      });
      const pinned = await loadedProjects(result);
      act(() =>
        pinned.onActionMenuOpen?.(
          pinned.projects[0],
          document.createElement('button'),
        ),
      );
      await waitFor(() =>
        expect(getShareRecipientsCount).toHaveBeenCalledWith(P),
      );
      expect((await actionsOf(result)).map((item) => item.key)).not.toContain(
        'revokeAccess',
      );
    });

    it('marks Delete as a danger item and leaves the others plain', async () => {
      const { result } = renderPanel();

      const items = await actionsOf(result);

      expect(items.find(({ key }) => key === 'delete')?.className).toBe(
        'text-error',
      );
      expect(
        items
          .filter(({ key }) => key !== 'delete')
          .every(({ className }) => className == null),
      ).toBe(true);
    });

    it('offers a share recipient with edit access Unpin, Edit and Remove from My List', async () => {
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
        'removeFromMyList',
      ]);
    });

    it('offers a view-only share recipient Unpin and Remove from My List', async () => {
      mocks.client.getProject.mockResolvedValue(
        details({
          canEdit: false,
          canManage: false,
          source: ProjectSource.Shared,
        }),
      );
      const { result } = renderPanel();

      const items = await actionsOf(result);

      expect(items.map(({ key }) => key)).toEqual([
        'unpin',
        'removeFromMyList',
      ]);
      expect(items[1].label).toBe('buttons.removeFromMyList');
      expect(items[1].className).toBeUndefined();
    });

    it('never offers Remove from My List for an organization project the user cannot manage', async () => {
      mocks.client.getProject.mockResolvedValue(
        details({
          canEdit: false,
          canManage: false,
          source: ProjectSource.Organization,
        }),
      );
      const { result } = renderPanel();

      expect((await actionsOf(result)).map(({ key }) => key)).toEqual([
        'unpin',
      ]);
    });

    it('opens the confirmation for Remove from My List without removing anything', async () => {
      mocks.client.getProject.mockResolvedValue(
        details({
          canEdit: false,
          canManage: false,
          source: ProjectSource.Shared,
        }),
      );
      const { result } = renderPanel();
      const items = await actionsOf(result);

      clickItem(items, 'removeFromMyList');

      expect(result.current.actionOverlay.action).toEqual({
        kind: PinnedProjectActionKind.RemoveFromMyList,
        projectId: P,
        isOpen: true,
      });
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
          expect.objectContaining({ message: 'projects.actions.unpinError' }),
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
      ['revokeAccess', PinnedProjectActionKind.RevokeAccess],
      ['delete', PinnedProjectActionKind.Delete],
    ])('opens the %s overlay for the project', async (key, kind) => {
      const { result } = renderPanel();
      const pinned = await loadedProjects(result);
      const trigger = document.createElement('button');
      await act(async () =>
        pinned.onActionMenuOpen?.(pinned.projects[0], trigger),
      );
      const items = await actionsOf(result);

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
  describe('collapsed projects', () => {
    const CHAT_ROUTE = '/projects/chat/bucket/support/conversations/c1';
    const stored = () =>
      localStorage.getItem(StorageKey.CollapsedPinnedProjects);
    const expanded = async (result: {
      current: ReturnType<typeof usePinnedProjectsPanel>;
    }) => (await loadedProjects(result)).projects[0].isExpanded;

    it('shows a project expanded and writes nothing until the user toggles it', async () => {
      const { result } = renderPanel();

      expect(await expanded(result)).toBe(true);
      expect(stored()).toBeNull();
    });

    it('collapses a project on toggle and keeps it collapsed after a reload', async () => {
      const view = renderPanel();
      const pinned = await loadedProjects(view.result);

      act(() => pinned.onToggleProject?.(P, false));

      await waitFor(() =>
        expect(view.result.current.pinnedProjects?.projects[0].isExpanded).toBe(
          false,
        ),
      );
      expect(JSON.parse(stored() ?? '[]')).toEqual([P]);
      view.unmount();

      const { result } = renderPanel();
      expect(await expanded(result)).toBe(false);
    });

    it('expands a collapsed project on toggle and drops its id', async () => {
      localStorage.setItem(
        StorageKey.CollapsedPinnedProjects,
        JSON.stringify([P]),
      );
      const { result } = renderPanel();
      const pinned = await loadedProjects(result);
      expect(pinned.projects[0].isExpanded).toBe(false);

      act(() => pinned.onToggleProject?.(P, true));

      await waitFor(() =>
        expect(result.current.pinnedProjects?.projects[0].isExpanded).toBe(
          true,
        ),
      );
      expect(JSON.parse(stored() ?? 'null')).toEqual([]);
    });

    it('shows the project of the open chat expanded without writing, and lets the user collapse it again', async () => {
      localStorage.setItem(
        StorageKey.CollapsedPinnedProjects,
        JSON.stringify([P]),
      );
      const { result } = renderPanel(CHAT_ROUTE);

      expect(await expanded(result)).toBe(true);
      expect(JSON.parse(stored() ?? 'null')).toEqual([P]);

      act(() => result.current.pinnedProjects?.onToggleProject?.(P, false));

      await waitFor(() =>
        expect(result.current.pinnedProjects?.projects[0].isExpanded).toBe(
          false,
        ),
      );
      expect(JSON.parse(stored() ?? 'null')).toEqual([P]);
    });

    it('keeps a stored collapsed project collapsed when the panel asks to collapse it', async () => {
      localStorage.setItem(
        StorageKey.CollapsedPinnedProjects,
        JSON.stringify([P]),
      );
      const { result } = renderPanel();
      const pinned = await loadedProjects(result);

      act(() => pinned.onToggleProject?.(P, false));

      await waitFor(() => expect(stored()).toBe(JSON.stringify([P])));
      expect(result.current.pinnedProjects?.projects[0].isExpanded).toBe(false);
    });

    it('does not duplicate an id when the panel asks to expand an already expanded project', async () => {
      const { result } = renderPanel();
      const pinned = await loadedProjects(result);

      act(() => pinned.onToggleProject?.(P, true));

      expect(await expanded(result)).toBe(true);
      expect(JSON.parse(stored() ?? '[]')).toEqual([]);
    });

    it('removes stored ids of projects that are no longer pinned once the user config has loaded', async () => {
      localStorage.setItem(
        StorageKey.CollapsedPinnedProjects,
        JSON.stringify([P, 'projects/bucket/gone']),
      );
      renderPanel();

      await waitFor(() => expect(JSON.parse(stored() ?? 'null')).toEqual([P]));
    });

    it('keeps every stored id while the user config is still loading', async () => {
      mocks.status = UserConfigStatus.Loading;
      mocks.pinnedProjectIds = [];
      localStorage.setItem(
        StorageKey.CollapsedPinnedProjects,
        JSON.stringify([P]),
      );
      renderPanel();

      await act(async () => undefined);

      expect(JSON.parse(stored() ?? 'null')).toEqual([P]);
    });

    it('keeps every stored id while projects are off', async () => {
      mocks.isEnabled = false;
      mocks.pinnedProjectIds = [];
      localStorage.setItem(
        StorageKey.CollapsedPinnedProjects,
        JSON.stringify([P]),
      );
      renderPanel();

      await act(async () => undefined);

      expect(JSON.parse(stored() ?? 'null')).toEqual([P]);
    });

    it.each(['null', '{}', '"x"', '[1,"a",null]'])(
      'ignores a stored value that is not a list of ids (%s)',
      async (value) => {
        localStorage.setItem(StorageKey.CollapsedPinnedProjects, value);
        const { result } = renderPanel();

        expect(await expanded(result)).toBe(true);
      },
    );

    it('collapses for the page session when storage cannot be written', async () => {
      const { result } = renderPanel();
      const pinned = await loadedProjects(result);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });

      act(() => pinned.onToggleProject?.(P, false));

      await waitFor(() =>
        expect(result.current.pinnedProjects?.projects[0].isExpanded).toBe(
          false,
        ),
      );
      vi.restoreAllMocks();
    });
  });
});
