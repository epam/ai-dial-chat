import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  PanelEmpty,
  PanelNoResults,
  SearchInput,
  SidebarOrientation,
  SidebarPanel,
} from '@epam/ai-dial-sidebar';
import { DialSkeleton } from '@epam/ai-dial-ui-kit';
import {
  type FC,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { List, type ListImperativeAPI } from 'react-window';
import { ITEM_ROW_HEIGHT } from '../../constants/virtual-list';
import { ConversationPanelProps } from '../../models/panel-props';
import {
  type RowRendererData,
  type VirtualRow,
  VirtualRowKind,
} from '../../models/virtual-row';
import { FilterTab } from '../../types/conversation-classification';
import {
  getRowHeight,
  getSkeletonWidth,
  SKELETON_ROW_COUNT,
} from '../../utils/conversation-row';
import {
  computeAllowedDropGroups,
  findGroupKeyForItem,
} from '../../utils/drag';
import { FilterTabs } from '../FilterTabs/FilterTabs';
import { NewChatButton } from '../NewChatButton/NewChatButton';
import { RowRenderer } from '../RowRenderer/RowRenderer';
import styles from './ConversationPanel.module.scss';
import { matchesSearch, matchesTab } from './utils';

const ALL_GROUP_KEYS = new Set<string>([
  FilterTab.Pinned,
  FilterTab.MyChats,
  FilterTab.Shared,
  FilterTab.Organization,
]);

/** Collapsible side panel showing the user's conversation history. */
export const ConversationPanel: FC<ConversationPanelProps> = memo(
  ({
    conversations,
    isLoading,
    isOpen,
    onSelectConversation,
    activeConversationId,
    labels,
    onNewChat,
    styles: panelStyles,
    className,
    getActions,
    onActionMenuOpen,
    onToggle,
    headerActions,
    onMoveConversation,
    activeFilter,
    onActiveFilterChange,
  }) => {
    const {
      colors,
      typography,
      newChatButton: newChatButtonColors,
    } = panelStyles ?? {};

    const {
      title,
      emptyLabel,
      noResultsLabel,
      loadingLabel = 'Loading conversations',
      newChatLabel,
      searchPlaceholder,
      searchClearLabel,
      filterLabels,
      groupLabels,
      actionsLabel,
      unreadIndicatorLabel,
      closeAriaLabel,
    } = labels;
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(FilterTab.All);

    useEffect(() => {
      if (activeFilter == null) return;
      setActiveTab(activeFilter);
    }, [activeFilter]);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
      () => ALL_GROUP_KEYS,
    );
    const [overscanCount, setOverscanCount] = useState(5);
    const listId = useId();
    const listRef = useRef<ListImperativeAPI>(null);
    const lastScrolledIdRef = useRef<string | null>(null);

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [allowedDropGroups, setAllowedDropGroups] =
      useState<Set<FilterTab> | null>(null);

    /*
     * Refs let the drop handler read current values without being in the useCallback dep array,
     * avoiding recreating the handler (and remounting rows) on every drag-state change.
     */
    const draggingIdRef = useRef<string | null>(null);
    const allowedDropGroupsRef = useRef<Set<FilterTab> | null>(null);

    const handleListResize = useCallback(({ height }: { height: number }) => {
      setOverscanCount(Math.ceil((height / ITEM_ROW_HEIGHT) * 2));
    }, []);

    const handleToggleGroup = useCallback((key: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    }, []);

    const clearDragState = useCallback(() => {
      draggingIdRef.current = null;
      allowedDropGroupsRef.current = null;
      setDraggingId(null);
      setDragOverId(null);
      setAllowedDropGroups(null);
    }, []);

    const handleDragStart = useCallback(
      (id: string, rows: VirtualRow[]) => {
        const groupKey = findGroupKeyForItem(rows, id);
        const allowed = computeAllowedDropGroups(id, groupKey, conversations);
        draggingIdRef.current = id;
        allowedDropGroupsRef.current = allowed;
        setDraggingId(id);
        setAllowedDropGroups(allowed);
      },
      [conversations],
    );

    const handleDragEnd = useCallback(() => {
      clearDragState();
    }, [clearDragState]);

    const handleDragOver = useCallback((id: string) => {
      setDragOverId(id);
    }, []);

    const handleDragLeave = useCallback(() => {
      setDragOverId(null);
    }, []);

    const handleDrop = useCallback(
      (targetId: string, targetGroupKey: FilterTab, afterId: string | null) => {
        const currentDraggingId = draggingIdRef.current;
        const currentAllowed = allowedDropGroupsRef.current;
        clearDragState();
        if (
          currentDraggingId != null &&
          currentDraggingId !== targetId &&
          currentAllowed?.has(targetGroupKey)
        ) {
          onMoveConversation?.({
            draggedId: currentDraggingId,
            targetGroupKey,
            afterId,
          });
        }
      },
      [clearDragState, onMoveConversation],
    );

    const cssVars = buildCssVars({
      '--cp-item-hover': colors?.itemHover,
      '--cp-item-active': colors?.itemActive,
      '--cp-text': colors?.text,
      '--cp-text-secondary': colors?.textSecondary,
      '--cp-new-chat-bg': newChatButtonColors?.background,
      '--cp-new-chat-text': newChatButtonColors?.text,
      '--cp-new-chat-focus-outline': newChatButtonColors?.focusOutline,
      '--cp-drop-zone-ring': colors?.dropZoneRing,
      '--cp-trigger-bg': colors?.triggerBackground,
      '--cp-trigger-icon': colors?.triggerIcon,
      '--cp-trigger-icon-idle': colors?.triggerIconIdle,
      '--cp-skeleton-color': colors?.skeletonColor,
      '--cp-task-badge-border': colors?.taskBadgeBorder,
      '--cp-task-badge-bg': colors?.taskBadgeBackground,
      '--cp-task-badge-text': colors?.taskBadgeText,
      '--cp-unread-dot': colors?.unreadDot,
    });

    const filteredItems = useMemo(
      () =>
        conversations.filter(
          (item) =>
            matchesTab(item, activeTab) && matchesSearch(item, searchQuery),
        ),
      [conversations, activeTab, searchQuery],
    );

    const pinnedItems = useMemo(
      () => filteredItems.filter((item) => item.isPinned),
      [filteredItems],
    );

    const myChatsItems = useMemo(
      () =>
        filteredItems.filter(
          (item) =>
            !item.isPinned &&
            item.source !== FilterTab.Shared &&
            item.source !== FilterTab.Organization,
        ),
      [filteredItems],
    );

    const sharedItems = useMemo(
      () =>
        filteredItems.filter(
          (item) => !item.isPinned && item.source === FilterTab.Shared,
        ),
      [filteredItems],
    );

    const organizationItems = useMemo(
      () =>
        filteredItems.filter(
          (item) => !item.isPinned && item.source === FilterTab.Organization,
        ),
      [filteredItems],
    );

    const groups = useMemo(
      () => [
        {
          key: FilterTab.Pinned,
          label: groupLabels?.pinned ?? 'Pinned',
          items: pinnedItems,
        },
        {
          key: FilterTab.MyChats,
          label: groupLabels?.myChats ?? 'My chats',
          items: myChatsItems,
        },
        {
          key: FilterTab.Shared,
          label: groupLabels?.shared ?? 'Shared',
          items: sharedItems,
        },
        {
          key: FilterTab.Organization,
          label: groupLabels?.organization ?? 'Organization',
          items: organizationItems,
        },
      ],
      [groupLabels, pinnedItems, myChatsItems, sharedItems, organizationItems],
    );

    const virtualRows = useMemo(() => {
      const rows: VirtualRow[] = [];
      for (const group of groups) {
        if (group.items.length === 0) continue;
        rows.push({
          kind: VirtualRowKind.Header,
          groupKey: group.key,
          label: group.label,
        });
        if (expandedGroups.has(group.key)) {
          for (const item of group.items) {
            rows.push({ kind: VirtualRowKind.Item, item, groupKey: group.key });
          }
        }
      }
      return rows;
    }, [groups, expandedGroups]);

    useEffect(() => {
      if (!activeConversationId) return;

      if (lastScrolledIdRef.current === activeConversationId) return;

      const index = virtualRows.findIndex(
        (row) =>
          row.kind === VirtualRowKind.Item &&
          row.item.id === activeConversationId,
      );
      if (index >= 0) {
        listRef.current?.scrollToRow({
          index,
          align: 'smart',
          behavior: 'smooth',
        });
        lastScrolledIdRef.current = activeConversationId;
      }
    }, [activeConversationId, groups, expandedGroups, virtualRows]);

    const rowProps = useMemo<RowRendererData>(
      () => ({
        rows: virtualRows,
        expandedGroups,
        onToggleGroup: handleToggleGroup,
        listId,
        activeConversationId,
        searchQuery,
        onSelectConversation,
        getActions,
        onActionMenuOpen,
        actionsLabel,
        unreadIndicatorLabel,
        styles: {
          groupHeaderClassName: typography?.groupHeaderClassName,
          itemTitleClassName: typography?.itemTitleClassName,
          itemIconBadgeClassName: panelStyles?.itemIconBadgeClassName,
          taskBadgeClassName: panelStyles?.taskBadgeClassName,
        },
        draggingId,
        dragOverId,
        allowedDropGroups,
        onDragStart: (id: string) => handleDragStart(id, virtualRows),
        onDragEnd: handleDragEnd,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
      }),
      [
        virtualRows,
        expandedGroups,
        handleToggleGroup,
        listId,
        activeConversationId,
        searchQuery,
        onSelectConversation,
        getActions,
        onActionMenuOpen,
        actionsLabel,
        unreadIndicatorLabel,
        typography?.groupHeaderClassName,
        typography?.itemTitleClassName,
        panelStyles?.itemIconBadgeClassName,
        panelStyles?.taskBadgeClassName,
        draggingId,
        dragOverId,
        allowedDropGroups,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
      ],
    );

    const isNoConversations = conversations.length === 0;
    const isNoResults = conversations.length > 0 && filteredItems.length === 0;

    return (
      <SidebarPanel
        isOpen={isOpen}
        orientation={SidebarOrientation.Left}
        title={title}
        labels={{ ariaLabel: title, closeLabel: closeAriaLabel }}
        onClose={onToggle}
        styles={{
          colors: {
            background: colors?.background,
            border: colors?.border,
          },
          typography: {
            fontClassName: typography?.fontClassName,
          },
          bodyClassName: 'flex flex-col overflow-hidden p-0 gap-3',
          cssVars,
          titleClassName: typography?.fontClassName,
          headerClassName: 'h-[64px]',
          className: mergeClasses(
            isOpen ? 'w-[324px] mobile:w-full' : 'w-0',
            className,
          ),
        }}
        rightActions={headerActions}
      >
        <NewChatButton
          label={newChatLabel}
          onClick={onNewChat}
          labelClassName={typography?.newChatLabelClassName}
          colors={newChatButtonColors}
        />

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          labels={{
            placeholder: searchPlaceholder,
            clearLabel: searchClearLabel,
          }}
        />

        <FilterTabs
          activeTab={activeTab}
          labels={filterLabels}
          onChange={(tab) => {
            setActiveTab(tab);
            onActiveFilterChange?.(tab);
          }}
          tabClassName={typography?.tabClassName}
        />

        <span role="status" aria-live="polite" className="sr-only">
          {isLoading
            ? loadingLabel
            : isNoConversations
              ? emptyLabel
              : isNoResults
                ? noResultsLabel
                : ''}
        </span>

        <div className="flex-1 overflow-hidden px-2 py-1">
          {isLoading ? (
            <div className="flex flex-col gap-3 px-2 py-3">
              {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                <DialSkeleton
                  key={i}
                  avatar={{ size: 24 }}
                  showTitle={{ width: getSkeletonWidth(i) }}
                  paragraph={false}
                  active
                  color={styles.skeletonColor}
                />
              ))}
            </div>
          ) : isNoConversations ? (
            <PanelEmpty label={emptyLabel} />
          ) : isNoResults ? (
            <PanelNoResults label={noResultsLabel} />
          ) : (
            <List<RowRendererData>
              listRef={listRef}
              id={listId}
              role="list"
              style={{ height: '100%' }}
              rowComponent={RowRenderer}
              rowCount={virtualRows.length}
              rowHeight={getRowHeight}
              overscanCount={overscanCount}
              onResize={handleListResize}
              rowProps={rowProps}
            />
          )}
        </div>
      </SidebarPanel>
    );
  },
);
