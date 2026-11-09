import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
  getPinnedProjectMenuActions,
  mapProjectSourceToFilterTab,
  PinnedProjectMenuAction,
  usePinnedProjectChats,
} from '@epam/ai-dial-chat-hooks/project';
import type {
  PinnedProjectGroup,
  PinnedProjects,
} from '@epam/ai-dial-conversation-panel';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconPencilMinus,
  IconPinnedFilled,
  IconShare,
  IconTrashX,
  IconWorldShare,
  type Icon,
} from '@tabler/icons-react';
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router';
import {
  getProjectConversationRoute,
  getProjectEditRoute,
  getProjectViewRoute,
  parseProjectConversationRouteParams,
  parseProjectRouteParams,
} from '../../constants/routes';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useNotification } from '../../context/NotificationContext';
import { useUserConfig } from '../../context/UserConfigContext';
import type { PinnedProjectActionState } from '../../models/pinned-project-action';
import { PinnedProjectActionKind } from '../../types/pinned-project-action';
import { ROUTES } from '../../types/routes';
import { StorageKey } from '../../types/storage-key';
import { UserConfigStatus } from '../../types/user-config-status';
import useLocalStorage from '../useLocalStorage';
import {
  projectsClient,
  subscribeProjectConversationViewed,
} from './projects-client';

/* A menu item's icon: Unpin shows the pinned state it removes, as on a pinned chat; Delete takes the error color. */
const renderMenuIcon = (
  icon: Icon,
  { isFilled = false, isDanger = false } = {},
) =>
  createElement(icon, {
    size: DIAL_ICON_SIZE.MD,
    className: isDanger ? 'text-error' : 'text-secondary',
    ...(isFilled ? {} : { stroke: DIAL_KIT_ICON_STROKE }),
    'aria-hidden': true,
  });

/** What the sidebar's pinned-project overlays need. */
export interface PinnedProjectActionOverlay {
  /** The open (or last opened) overlay, or `null`. */
  action: PinnedProjectActionState | null;
  /** The action's project as last read, or `null` once it left the tree. */
  project: ProjectDetailsDto | null;
  /** Id of the project the current route shows (its view, edit or chat page). */
  routeProjectId?: string;
  /** The ⋮ trigger that opened the action, for focus to return to. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  /** Closes the overlay. */
  onClose: () => void;
  /** Re-reads one project of the tree, e.g. after a delete lost to a concurrent change. */
  onProjectChanged: (projectId: string) => void;
}

/**
 * App adapter of `usePinnedProjectChats` for the navigation sidebar: the
 * pinned projects' trees as the conversation list's `pinnedProjects`, their
 * routes and ⋮ actions, and the state of the overlays those actions open.
 * Gated by `projectsEnabled`; with the flag off no request is sent and
 * `pinnedProjects` is `undefined`.
 *
 * @param onOpenRoute - Opens an app route the way the sidebar opens a chat; it must be referentially stable.
 */
export const usePinnedProjectsPanel = (onOpenRoute: (path: string) => void) => {
  const { t } = useTranslation();
  const isEnabled = useFeatureFlag('projectsEnabled');
  const { pinnedProjectIds, setPinnedProject, replacePinnedProjectId, status } =
    useUserConfig();
  const { showErrorNotification } = useNotification();

  const chatMatch = useMatch(ROUTES.ProjectChat);
  const viewMatch = useMatch(ROUTES.ProjectView);
  const editMatch = useMatch(ROUTES.ProjectEdit);
  const chatRoute = chatMatch
    ? parseProjectConversationRouteParams(chatMatch.params)
    : null;
  const pageMatch = viewMatch ?? editMatch;
  const activeConversationId = chatRoute?.conversationId;
  const activeProjectId =
    (pageMatch ? parseProjectRouteParams(pageMatch.params) : null) ?? undefined;
  const routeProjectId = chatRoute?.projectId ?? activeProjectId;

  /* A project deleted by someone else keeps its pin in the user config, so
     the unpin is written; when that fails it is mirrored locally only, so a
     rolled-back pin cannot reload and report the project again. */
  const handleProjectDeleted = useCallback(
    async (projectId: string) => {
      try {
        await setPinnedProject(projectId, false);
      } catch {
        replacePinnedProjectId(projectId, null);
      }
    },
    [setPinnedProject, replacePinnedProjectId],
  );
  const { projects, markViewed, refresh } = usePinnedProjectChats(
    projectsClient,
    pinnedProjectIds,
    { enabled: isEnabled, onProjectDeleted: handleProjectDeleted },
  );

  /* A chat read on a project page loses its dot here too. */
  useEffect(() => {
    if (!isEnabled) return;
    return subscribeProjectConversationViewed(markViewed);
  }, [isEnabled, markViewed]);

  /* Only a click on a chevron writes these ids; a project with no entry is expanded. */
  const [storedIds, setCollapsedIds] = useLocalStorage<string[]>(
    StorageKey.CollapsedPinnedProjects,
    [],
  );
  /* `useLocalStorage` only guards the JSON, so a hand-edited or foreign value of another shape must not reach the list code. */
  const collapsedIds = useMemo(
    () =>
      Array.isArray(storedIds)
        ? storedIds.filter((id): id is string => typeof id === 'string')
        : [],
    [storedIds],
  );
  const collapsedSet = useMemo(() => new Set(collapsedIds), [collapsedIds]);
  /* The project of the most recently opened chat, shown expanded without a write. */
  const [revealedId, setRevealedId] = useState<string>();
  const chatProjectId = chatRoute?.projectId;
  const revealedChatRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (activeConversationId == null || chatProjectId == null) {
      revealedChatRef.current = undefined;
      return;
    }
    if (revealedChatRef.current === activeConversationId) return;
    revealedChatRef.current = activeConversationId;
    setRevealedId(chatProjectId);
  }, [activeConversationId, chatProjectId]);

  /* `pinnedProjectIds` is empty until the user config has loaded, so an earlier pass would erase every stored id. */
  useEffect(() => {
    if (!isEnabled || status !== UserConfigStatus.Ready) return;
    const pinned = new Set(pinnedProjectIds);
    const kept = collapsedIds.filter((id) => pinned.has(id));
    if (kept.length !== collapsedIds.length) setCollapsedIds(kept);
  }, [isEnabled, status, pinnedProjectIds, collapsedIds, setCollapsedIds]);

  /* The panel reports the state the user asked for, so a search override it owns cannot make the host store the opposite. */
  const handleToggleProject = useCallback(
    (projectId: string, shouldExpand: boolean) => {
      if (shouldExpand) {
        setCollapsedIds(collapsedIds.filter((id) => id !== projectId));
        return;
      }
      if (!collapsedIds.includes(projectId)) {
        setCollapsedIds([...collapsedIds, projectId]);
      }
      setRevealedId((current) => (current === projectId ? undefined : current));
    },
    [collapsedIds, setCollapsedIds],
  );

  const projectsById = useMemo(
    () => new Map(projects.map((entry) => [entry.project.id, entry.project])),
    [projects],
  );

  /* The open chat shows read, hiding the moment between a generation's end and its viewed mark. */
  const groups = useMemo<PinnedProjectGroup[]>(
    () =>
      projects.map(({ project, chats, hasMore }) => ({
        id: project.id,
        name: project.name,
        href: getProjectViewRoute(project.id),
        source: mapProjectSourceToFilterTab(project.source),
        hasMore,
        isExpanded: !collapsedSet.has(project.id) || revealedId === project.id,
        conversations: chats.map((chat) => ({
          id: chat.id,
          title: chat.title,
          href: getProjectConversationRoute(chat.id),
          ...(chat.isUnread && chat.id !== activeConversationId
            ? { isUnread: true }
            : {}),
        })),
      })),
    [projects, activeConversationId, collapsedSet, revealedId],
  );

  const handleOpenProject = useCallback(
    (projectId: string) => onOpenRoute(getProjectViewRoute(projectId)),
    [onOpenRoute],
  );
  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      markViewed(conversationId);
      onOpenRoute(getProjectConversationRoute(conversationId));
    },
    [markViewed, onOpenRoute],
  );

  const [action, setAction] = useState<PinnedProjectActionState | null>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const handleActionMenuOpen = useCallback(
    (group: PinnedProjectGroup, trigger: HTMLButtonElement) => {
      actionTriggerRef.current = trigger;
    },
    [],
  );
  const openAction = useCallback(
    (kind: PinnedProjectActionKind, projectId: string) =>
      setAction({ kind, projectId, isOpen: true }),
    [],
  );
  const closeAction = useCallback(
    () => setAction((current) => current && { ...current, isOpen: false }),
    [],
  );

  const handleUnpin = useCallback(
    async (projectId: string) => {
      try {
        await setPinnedProject(projectId, false);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showErrorNotification({
          message: t(ProjectsI18nKeys.ActionsUnpinError),
          requestId: traceId,
        });
      }
    },
    [setPinnedProject, showErrorNotification, t],
  );

  /* The lib decides which actions a project offers; the app supplies each one's label, icon and handler. */
  const getActions = useCallback(
    (group: PinnedProjectGroup): DropdownItem[] => {
      const items: Record<PinnedProjectMenuAction, DropdownItem> = {
        [PinnedProjectMenuAction.Unpin]: {
          key: PinnedProjectMenuAction.Unpin,
          label: t(ButtonsI18nKeys.Unpin),
          icon: renderMenuIcon(IconPinnedFilled, { isFilled: true }),
          onClick: () => {
            void handleUnpin(group.id);
          },
        },
        [PinnedProjectMenuAction.Edit]: {
          key: PinnedProjectMenuAction.Edit,
          label: t(ButtonsI18nKeys.Edit),
          icon: renderMenuIcon(IconPencilMinus),
          onClick: () => onOpenRoute(getProjectEditRoute(group.id)),
        },
        [PinnedProjectMenuAction.Publish]: {
          key: PinnedProjectMenuAction.Publish,
          label: t(ButtonsI18nKeys.Publish),
          icon: renderMenuIcon(IconWorldShare),
          onClick: () => openAction(PinnedProjectActionKind.Publish, group.id),
        },
        [PinnedProjectMenuAction.Share]: {
          key: PinnedProjectMenuAction.Share,
          label: t(ButtonsI18nKeys.Share),
          icon: renderMenuIcon(IconShare),
          onClick: () => openAction(PinnedProjectActionKind.Share, group.id),
        },
        [PinnedProjectMenuAction.Delete]: {
          key: PinnedProjectMenuAction.Delete,
          label: t(ButtonsI18nKeys.Delete),
          icon: renderMenuIcon(IconTrashX, { isDanger: true }),
          className: 'text-error',
          onClick: () => openAction(PinnedProjectActionKind.Delete, group.id),
        },
        [PinnedProjectMenuAction.RemoveFromMyList]: {
          key: PinnedProjectMenuAction.RemoveFromMyList,
          label: t(ButtonsI18nKeys.RemoveFromMyList),
          icon: renderMenuIcon(IconTrashX),
          onClick: () =>
            openAction(PinnedProjectActionKind.RemoveFromMyList, group.id),
        },
      };
      return getPinnedProjectMenuActions(projectsById.get(group.id)).map(
        (action) => items[action],
      );
    },
    [handleUnpin, onOpenRoute, openAction, projectsById, t],
  );

  const pinnedProjects = useMemo<PinnedProjects | undefined>(
    () =>
      isEnabled
        ? {
            projects: groups,
            onSelectProject: handleOpenProject,
            onSelectConversation: handleSelectConversation,
            onSeeAll: handleOpenProject,
            onToggleProject: handleToggleProject,
            getActions,
            onActionMenuOpen: handleActionMenuOpen,
            activeProjectId,
          }
        : undefined,
    [
      isEnabled,
      groups,
      handleOpenProject,
      handleSelectConversation,
      handleToggleProject,
      getActions,
      handleActionMenuOpen,
      activeProjectId,
    ],
  );

  const actionProject =
    action == null ? null : (projectsById.get(action.projectId) ?? null);
  const actionOverlay = useMemo<PinnedProjectActionOverlay>(
    () => ({
      action,
      project: actionProject,
      routeProjectId,
      returnFocusRef: actionTriggerRef,
      onClose: closeAction,
      onProjectChanged: refresh,
    }),
    [action, actionProject, routeProjectId, closeAction, refresh],
  );

  return {
    /** The Pinned section's project trees, or `undefined` with projects off. */
    pinnedProjects,
    /** The project chat the current route opens, for the list's active row. */
    activeConversationId,
    /** State and callbacks of the overlays the ⋮ actions open. */
    actionOverlay,
  };
};
