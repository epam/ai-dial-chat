import {
  type ConversationListItemDto,
  type DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  createDeploymentLookup,
  useActiveConversationSync,
  useConversationLookupMaps,
  useConversationPanelItems,
  useVisibleConversationIdsReporter,
} from '@epam/ai-dial-chat-hooks';
import { applyActiveScheduledTaskRun } from '@epam/ai-dial-chat-hooks/conversation';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { ConversationListSection } from '@epam/ai-dial-conversation-panel';
import { DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconClockHour3 } from '@tabler/icons-react';
import { memo, useCallback, useMemo, type FC } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CELEBRATION_HISTORY_CLASS } from '../../constants/celebration';
import { getConversationRoute } from '../../constants/routes';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useConversationEditDialogs } from '../../hooks/conversation-panel/useConversationEditDialogs';
import { useConversationRowActions } from '../../hooks/conversation-panel/useConversationRowActions';
import { useConversationSharingDialogs } from '../../hooks/conversation-panel/useConversationSharingDialogs';
import { useConversationTransfer } from '../../hooks/conversation-panel/useConversationTransfer';
import { useLanguage } from '../../hooks/language/useLanguage';
import { usePinnedProjectsPanel } from '../../hooks/projects/usePinnedProjectsPanel';
import { useDeleteConfirmationLabels } from '../../hooks/useDeleteConfirmationLabels';
import { useUiFeature } from '../../hooks/useUiFeature';
import { groupScheduledTaskConversations } from '../../utils/collapse-scheduled-task-conversations';
import {
  conversationIdsMatch,
  toPanelConversationId,
} from '../../utils/conversation-id-match';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import ConversationPanelMenu from './ConversationPanelMenu';
import ConversationPanelOverlays from './ConversationPanelOverlays';

/*
 * A scheduled-task conversation always shows the Scheduled tasks glyph in a
 * tinted tile instead of its deployment avatar. One shared element keeps the
 * panel items' memoised output stable.
 */
const SCHEDULED_TASK_ICON = (
  <span
    className="flex size-6 items-center justify-center rounded-lg bg-blue p-1 text-blue"
    aria-hidden
  >
    <IconClockHour3 size={16} stroke={DIAL_KIT_ICON_STROKE} />
  </span>
);
const isScheduledTaskConversation = (item: ConversationListItemDto) =>
  item.isScheduledTask;

interface ConversationPanelViewProps {
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  /* Opens an app route from the sidebar, e.g. a pinned project's chat; must be stable. */
  onOpenRoute: (path: string) => void;
  requestedFilter?: FilterTab;
  onRequestedFilterChange?: () => void;
  onActiveFilterChange?: (tab: FilterTab) => void;
  onDuplicateReadonly?: () => void;
  /* False while the desktop sidebar is collapsed or the mobile drawer is closed. */
  isVisible?: boolean;
}

const ConversationPanelView: FC<ConversationPanelViewProps> = ({
  activeConversationId,
  onSelectConversation,
  onOpenRoute,
  requestedFilter,
  onRequestedFilterChange,
  onActiveFilterChange,
  onDuplicateReadonly,
  isVisible = true,
}) => {
  const { t } = useTranslation();
  const deleteConfirmationLabels = useDeleteConfirmationLabels();
  const { language } = useLanguage();
  const isConversationsSectionEnabled = useUiFeature(
    OverlayFeature.ConversationsSection,
  );
  const isConversationsSharingEnabled = useUiFeature(
    OverlayFeature.ConversationsSharing,
  );
  const isConversationsPublishingEnabled = useUiFeature(
    OverlayFeature.ConversationsPublishing,
  );
  const isScheduledTasksEnabled = useFeatureFlag('scheduledTasksEnabled');
  const isConversationsFilterHidden = useUiFeature(
    OverlayFeature.HideConversationsFilter,
  );
  const isConversationExportHidden = useUiFeature(
    OverlayFeature.HideConversationExport,
  );
  const isConversationImportHidden = useUiFeature(
    OverlayFeature.HideConversationImport,
  );
  const {
    conversations: items,
    isLoading,
    isUpdatingTitles,
    markConversationViewed,
    refreshConversations,
    setVisibleConversationIds,
  } = useConversations();
  const transfer = useConversationTransfer();
  const { exportSingle, handleExportAll, handleImportClick } = transfer;

  const {
    items: deployments,
    isLoading: isDeploymentsLoading,
    selectedItemId,
  } = useDeployments();

  /* Menu lookups run for every visible row after recipient/history updates.
     Normalize the deployment list once instead of scanning it per candidate. */
  const findDeployment = useMemo(
    () => createDeploymentLookup(deployments),
    [deployments],
  );

  /*
   * Only scheduled runs are marked viewed from here. The sync fires on every
   * re-entry into a chat, and the panel cannot tell whether the chat is still
   * generating: writing the id to the viewed ids mid-stream would hide the dot
   * for good. The conversation page marks regular chats once no generation is
   * running.
   */
  const panelActiveConversationId = useActiveConversationSync({
    activeConversationId,
    items,
    refreshConversations,
    markConversationViewed,
    conversationIdsMatch,
    toPanelConversationId,
    shouldMarkViewed: isScheduledTaskConversation,
  });
  const {
    pinnedProjects,
    activeConversationId: activeProjectConversationId,
    actionOverlay: pinnedProjectActionOverlay,
  } = usePinnedProjectsPanel(onOpenRoute);

  const editDialogs = useConversationEditDialogs({
    items,
    panelActiveConversationId,
  });
  const { openDeleteDialog, openRenameDialog } = editDialogs;
  const sharingDialogs = useConversationSharingDialogs({
    items,
    panelActiveConversationId,
  });
  const {
    openUnshareDialog,
    openRevokeDialog,
    openUnpublishDialog,
    setSelectedUnpublishFolder,
    setPendingShareConversationPath,
    setPendingPublishConversation,
    requestRecipientsCount,
    getRecipientsCount,
    requestPublishHistory,
    getPublishHistory,
  } = sharingDialogs;

  /** Map panel id → context id for reverse lookup */
  const { toContextId, getRawItem } = useConversationLookupMaps({
    items,
    toPanelConversationId,
  });

  const unreadIndicatorLabel = t(
    ConversationPanelI18nKeys.UnreadIndicatorLabel,
  );

  const resolveIconUrl = useCallback(
    (deployment: DeploymentItemDto | undefined) =>
      deployment?.iconUrl
        ? resolveCatalogIconUrl(deployment.iconUrl)
        : undefined,
    [],
  );

  const resolveIconTooltip = useCallback(
    (deployment: DeploymentItemDto | undefined, fallback: string) =>
      deployment
        ? resolveLocalizedText(deployment.displayName, language)
        : fallback || undefined,
    [language],
  );

  const resolveHref = useCallback((id: string) => getConversationRoute(id), []);

  const resolveTaskPresentation = useCallback(
    (item: ConversationListItemDto) =>
      item.isScheduledTask
        ? { leadingIcon: SCHEDULED_TASK_ICON, isUnread: item.isUnread ?? false }
        : undefined,
    [],
  );

  /*
   * The panel shows one row per scheduled task. This is a display derivation
   * only: every other consumer (active-conversation sync, task banner, History
   * unread marks) keeps reading the full `items` list from the context.
   */
  const scheduledTaskGrouping = useMemo(
    () => groupScheduledTaskConversations(items, { conversationIdsMatch }),
    [items],
  );
  /* Keeps the grouping's own array unless an older run is open, so most
     navigations leave the panel list — and every row — untouched. */
  const panelItems = useMemo(
    () =>
      applyActiveScheduledTaskRun(scheduledTaskGrouping, activeConversationId),
    [scheduledTaskGrouping, activeConversationId],
  );

  /* Viewport priority for title enrichment. */
  const handleVisibleConversationIdsChange = useVisibleConversationIdsReporter({
    items: panelItems,
    isVisible,
    toPanelConversationId,
    setVisibleConversationIds,
  });

  const conversations = useConversationPanelItems({
    items: panelItems,
    deployments,
    isDeploymentsLoading,
    toPanelConversationId,
    resolveIconUrl,
    resolveIconTooltip,
    resolveHref,
    resolveTaskPresentation,
  });

  /*
   * The open chat is never shown as unread: watching a chat that is generating
   * must not flash a dot, and the dot appears the moment the user navigates
   * away. A display rule only — the list keeps the chat unread, so leaving
   * mid-stream needs no extra state. Keeps the mapped array while the open row
   * carries no dot, so most navigations leave every row untouched.
   */
  const displayedConversations = useMemo(() => {
    const unreadActiveIndex = panelActiveConversationId
      ? conversations.findIndex(
          (c) => c.id === panelActiveConversationId && c.isUnread,
        )
      : -1;
    if (unreadActiveIndex === -1) return conversations;
    const next = conversations.slice();
    next[unreadActiveIndex] = { ...next[unreadActiveIndex], isUnread: false };
    return next;
  }, [conversations, panelActiveConversationId]);

  const filterLabels = useMemo(
    () => ({
      all: t(ConversationPanelI18nKeys.FilterAll),
      myChats: t(ConversationPanelI18nKeys.MyChatsSection),
      shared: t(ConversationPanelI18nKeys.FilterShared),
      organization: t(BasicI18nKeys.Organization),
      personal: t(ConversationPanelI18nKeys.FilterPersonal),
      type: t(ConversationPanelI18nKeys.FilterType),
      origin: t(ConversationPanelI18nKeys.FilterOrigin),
      chat: t(ConversationPanelI18nKeys.FilterChat),
      task: t(ConversationPanelI18nKeys.FilterTask),
      groupAriaLabel: t(ConversationPanelI18nKeys.FilterGroupAriaLabel),
    }),
    [t],
  );

  const groupLabels = useMemo(
    () => ({
      pinned: t(ConversationPanelI18nKeys.PinnedSection),
      myChats: t(ConversationPanelI18nKeys.MyChatsSection),
      shared: t(ConversationPanelI18nKeys.FilterShared),
      organization: t(BasicI18nKeys.Organization),
    }),
    [t],
  );

  const {
    rowActionsTriggerRef,
    handleMoveConversation,
    handleActionMenuOpen,
    getActions,
  } = useConversationRowActions({
    panelActiveConversationId,
    conversations,
    toContextId,
    getRawItem,
    findDeployment,
    selectedItemId,
    isConversationsSharingEnabled,
    isConversationsPublishingEnabled,
    isConversationExportHidden,
    onDuplicateReadonly,
    exportSingle,
    openDeleteDialog,
    openRenameDialog,
    openUnshareDialog,
    openRevokeDialog,
    openUnpublishDialog,
    setSelectedUnpublishFolder,
    setPendingShareConversationPath,
    setPendingPublishConversation,
    requestRecipientsCount,
    getRecipientsCount,
    requestPublishHistory,
    getPublishHistory,
  });

  const handleActiveFilterChange = useCallback(
    (tab: FilterTab) => {
      onRequestedFilterChange?.();
      onActiveFilterChange?.(tab);
    },
    [onRequestedFilterChange, onActiveFilterChange],
  );

  const panelHeaderActions = useMemo(
    () => (
      <ConversationPanelMenu
        activeConversationId={activeConversationId}
        onExportAll={isConversationExportHidden ? undefined : handleExportAll}
        onImport={isConversationImportHidden ? undefined : handleImportClick}
      />
    ),
    [
      activeConversationId,
      isConversationExportHidden,
      isConversationImportHidden,
      handleExportAll,
      handleImportClick,
    ],
  );

  /* Stable, so the memoised section is not re-rendered with every view render. */
  const sectionLabels = useMemo(
    () => ({
      title: t(ConversationPanelI18nKeys.ChatsAndTasks),
      searchOpenLabel: t(ConversationPanelI18nKeys.SearchOpen),
      searchCloseLabel: t(ConversationPanelI18nKeys.SearchClose),
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
      searchClearLabel: t(BasicI18nKeys.ClearSearch),
      filterLabels,
      filterActiveLabel: t(ConversationPanelI18nKeys.FilterApplied),
      emptyLabel: t(ConversationPanelI18nKeys.Empty),
      emptyDescription: t(ConversationPanelI18nKeys.EmptyDescription),
      noResultsLabel: t(ConversationPanelI18nKeys.NoResults),
      updatingTitlesLabel: t(ConversationPanelI18nKeys.UpdatingTitles),
      noResultsDescription: t(BasicI18nKeys.NoResultsDescription),
      tabEmptyLabels: {
        [FilterTab.MyChats]: {
          label: t(ConversationPanelI18nKeys.MyChatsEmpty),
          description: t(ConversationPanelI18nKeys.EmptyDescription),
        },
        [FilterTab.Shared]: {
          label: t(ConversationPanelI18nKeys.SharedEmpty),
          description: t(ConversationPanelI18nKeys.SharedEmptyDescription),
        },
        [FilterTab.Organization]: {
          label: t(ConversationPanelI18nKeys.OrganizationEmpty),
          description: t(
            ConversationPanelI18nKeys.OrganizationEmptyDescription,
          ),
        },
      },
      groupLabels,
      actionsLabel: t(ButtonsI18nKeys.MoreActions),
      unreadIndicatorLabel,
      seeAllLabel: t(ConversationPanelI18nKeys.SeeAll),
      seeAllAriaLabel: (name: string) =>
        t(ConversationPanelI18nKeys.SeeAllProjectChats, { name }),
    }),
    [t, filterLabels, groupLabels, unreadIndicatorLabel],
  );

  const sidebarBlock = (
    <ConversationListSection
      conversations={displayedConversations}
      isLoading={isLoading}
      isUpdatingTitles={isUpdatingTitles}
      preserveActiveSearchResult
      activeConversationId={
        activeProjectConversationId ?? panelActiveConversationId
      }
      requestedFilter={requestedFilter}
      isFilterHidden={isConversationsFilterHidden}
      isTypeFilterHidden={!isScheduledTasksEnabled}
      labels={sectionLabels}
      headerActions={panelHeaderActions}
      onSelectConversation={onSelectConversation}
      onFilterChange={handleActiveFilterChange}
      getActions={getActions}
      onActionMenuOpen={handleActionMenuOpen}
      onMoveConversation={handleMoveConversation}
      onVisibleConversationIdsChange={handleVisibleConversationIdsChange}
      pinnedProjects={pinnedProjects}
      listClassName={CELEBRATION_HISTORY_CLASS}
    />
  );

  return (
    <>
      {isConversationsSectionEnabled && sidebarBlock}
      {createPortal(
        <ConversationPanelOverlays
          transfer={transfer}
          editDialogs={editDialogs}
          sharingDialogs={sharingDialogs}
          deleteConfirmationLabels={deleteConfirmationLabels}
          pinnedProjectActionOverlay={pinnedProjectActionOverlay}
          rowActionsTriggerRef={rowActionsTriggerRef}
          isConversationsSharingEnabled={isConversationsSharingEnabled}
          isConversationsPublishingEnabled={isConversationsPublishingEnabled}
        />,
        document.body,
      )}
    </>
  );
};

export default memo(ConversationPanelView);
