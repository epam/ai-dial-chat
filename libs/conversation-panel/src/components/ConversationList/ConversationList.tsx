import {
  buildCssVars,
  FilterTab,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { PanelEmpty, PanelNoResults } from '@epam/ai-dial-sidebar';
import { Skeleton } from '@epam/ai-dial-ui-kit';
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
import { CONVERSATION_PANEL_CLASS } from '../../constants/public-class-names';
import type { ConversationListProps } from '../../models/conversation-list';
import type { RowRendererData, VirtualRow } from '../../models/virtual-row';
import { ConversationTypeFilter } from '../../types/conversation-kind';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { VirtualRowKind } from '../../types/virtual-row';
import {
  matchesKind,
  matchesSearch,
  matchesTab,
} from '../../utils/conversation-filter';
import {
  getOverscanCount,
  getRowHeight,
  getSkeletonWidth,
  SKELETON_ROW_COUNT,
} from '../../utils/conversation-row';
import {
  computeAllowedDropGroups,
  findGroupKeyForItem,
} from '../../utils/drag';
import panelStyles from '../ConversationPanel/ConversationPanel.module.scss';
import { RowRenderer } from '../RowRenderer/RowRenderer';

const ALL_GROUP_KEYS = new Set<string>([
  FilterTab.Pinned,
  FilterTab.MyChats,
  FilterTab.Shared,
  FilterTab.Organization,
]);

/** Virtualized, grouped, collapsible list of conversations without any panel chrome. */
export const ConversationList: FC<ConversationListProps> = memo(
  ({
    conversations,
    isLoading,
    onSelectConversation,
    activeConversationId,
    labels,
    searchQuery = '',
    activeFilter = FilterTab.All,
    activeTypeFilter = ConversationTypeFilter.All,
    hiddenSources,
    rowVariant,
    getActions,
    onActionMenuOpen,
    onMoveConversation,
    styles,
    id,
    className,
  }) => {
    const { colors, typography, itemIconBadgeClassName } = styles ?? {};
    const {
      emptyLabel,
      emptyDescription,
      noResultsLabel,
      noResultsDescription,
      loadingLabel = 'Loading conversations',
      groupLabels,
      actionsLabel,
      unreadIndicatorLabel,
    } = labels;

    /*
     * Dropped before any tab/search filtering so a hidden source never
     * surfaces under `All` or as a group heading, not just off its own tab.
     */
    const visibleConversations = useMemo(
      () =>
        hiddenSources?.length
          ? conversations.filter(
              (item) =>
                item.source == null || !hiddenSources.includes(item.source),
            )
          : conversations,
      [conversations, hiddenSources],
    );

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
      setOverscanCount(getOverscanCount(height));
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
        const allowed = computeAllowedDropGroups(
          id,
          groupKey,
          visibleConversations,
        );
        draggingIdRef.current = id;
        allowedDropGroupsRef.current = allowed;
        setDraggingId(id);
        setAllowedDropGroups(allowed);
      },
      [visibleConversations],
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
      '--cp-drop-zone-ring': colors?.dropZoneRing,
      '--cp-trigger-bg': colors?.triggerBackground,
      '--cp-trigger-icon': colors?.triggerIcon,
      '--cp-trigger-icon-idle': colors?.triggerIconIdle,
      '--cp-skeleton-color': colors?.skeletonColor,
      '--cp-unread-dot': colors?.unreadDot,
      '--cp-indicator-dot': colors?.indicatorDot,
      '--cp-list-font-family': typography?.fontFamily,
    });

    const filteredItems = useMemo(
      () =>
        visibleConversations.filter(
          (item) =>
            matchesTab(item, activeFilter) &&
            matchesKind(item, activeTypeFilter) &&
            matchesSearch(item, searchQuery),
        ),
      [visibleConversations, activeFilter, activeTypeFilter, searchQuery],
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

    /* Read at drag time so `onDragStart` keeps its identity across list
       changes and `memo(ConversationRow)` is not defeated by it. */
    const virtualRowsRef = useRef(virtualRows);
    useEffect(() => {
      virtualRowsRef.current = virtualRows;
    }, [virtualRows]);
    const handleRowDragStart = useCallback(
      (id: string) => handleDragStart(id, virtualRowsRef.current),
      [handleDragStart],
    );

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
        rowVariant,
        styles: {
          groupHeaderClassName: typography?.groupHeaderClassName,
          itemTitleClassName: typography?.itemTitleClassName,
          itemIconBadgeClassName,
        },
        draggingId,
        dragOverId,
        allowedDropGroups,
        onDragStart: handleRowDragStart,
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
        rowVariant,
        typography?.groupHeaderClassName,
        typography?.itemTitleClassName,
        itemIconBadgeClassName,
        draggingId,
        dragOverId,
        allowedDropGroups,
        handleRowDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
      ],
    );

    const isNoConversations = visibleConversations.length === 0;
    const isNoResults =
      visibleConversations.length > 0 && filteredItems.length === 0;

    const getStatusMessage = (): string => {
      if (isLoading) return loadingLabel;
      if (isNoConversations) return emptyLabel;
      if (isNoResults) return noResultsLabel;
      return '';
    };

    const renderBody = () => {
      if (isLoading) {
        return (
          <div className="flex flex-col gap-3 px-2 py-3">
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
              <Skeleton
                key={i}
                avatar={{ size: 24 }}
                showTitle={{ width: getSkeletonWidth(i) }}
                paragraph={false}
                active
                color={panelStyles.skeletonColor}
              />
            ))}
          </div>
        );
      }
      if (isNoConversations)
        return <PanelEmpty label={emptyLabel} description={emptyDescription} />;
      if (isNoResults)
        return (
          <PanelNoResults
            label={noResultsLabel}
            description={noResultsDescription}
          />
        );
      return (
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
      );
    };

    return (
      <div
        id={id}
        style={cssVars}
        className={mergeClasses(
          'flex-1 overflow-hidden px-3',
          panelStyles.list,
          typography?.fontClassName,
          /* Indicator rows sit flush against the footer; the panel keeps its
             vertical breathing room. */
          rowVariant !== ConversationRowVariant.Indicator && 'py-1',
          className,
          CONVERSATION_PANEL_CLASS.list,
        )}
      >
        <span role="status" aria-live="polite" className="sr-only">
          {getStatusMessage()}
        </span>
        {renderBody()}
      </div>
    );
  },
);
