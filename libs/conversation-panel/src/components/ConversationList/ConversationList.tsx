import {
  buildCssVars,
  FilterTab,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { PanelEmpty, PanelNoResults } from '@epam/ai-dial-sidebar';
import { Skeleton, LiveRegion, LiveRegionElement } from '@epam/ai-dial-ui-kit';
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
  getConversationIdsInRange,
  getOverscanCount,
  getRowHeight,
  getSkeletonWidth,
  isSameIdSequence,
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
    isUpdatingTitles = false,
    preserveActiveSearchResult = false,
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
    onVisibleConversationIdsChange,
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
      sharedEmptyDescription = noResultsDescription,
      tabEmptyLabels,
      loadingLabel = 'Loading conversations',
      updatingTitlesLabel = 'Updating conversation names',
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

    const [retainedSearchResult, setRetainedSearchResult] = useState<{
      id: string;
      query: string;
    } | null>(null);

    useEffect(() => {
      if (
        !preserveActiveSearchResult ||
        !searchQuery ||
        !activeConversationId
      ) {
        setRetainedSearchResult(null);
        return;
      }
      const active = visibleConversations.find(
        (item) => item.id === activeConversationId,
      );
      setRetainedSearchResult((previous) => {
        if (active && matchesSearch(active, searchQuery)) {
          return previous?.id === active.id && previous.query === searchQuery
            ? previous
            : { id: active.id, query: searchQuery };
        }
        return previous?.id === activeConversationId &&
          previous.query === searchQuery
          ? previous
          : null;
      });
    }, [
      preserveActiveSearchResult,
      searchQuery,
      activeConversationId,
      visibleConversations,
    ]);

    const handleSelectConversation = useCallback(
      (selectedId: string) => {
        if (preserveActiveSearchResult && searchQuery) {
          setRetainedSearchResult({ id: selectedId, query: searchQuery });
        }
        onSelectConversation(selectedId);
      },
      [preserveActiveSearchResult, searchQuery, onSelectConversation],
    );

    const retainedId =
      preserveActiveSearchResult &&
      searchQuery !== '' &&
      retainedSearchResult?.query === searchQuery &&
      retainedSearchResult.id === activeConversationId
        ? retainedSearchResult.id
        : undefined;
    const filteredItems = useMemo(
      () =>
        visibleConversations.filter(
          (item) =>
            matchesTab(item, activeFilter) &&
            matchesKind(item, activeTypeFilter) &&
            (matchesSearch(item, searchQuery) || item.id === retainedId),
        ),
      [
        visibleConversations,
        activeFilter,
        activeTypeFilter,
        searchQuery,
        retainedId,
      ],
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
        onSelectConversation: handleSelectConversation,
        getActions,
        onActionMenuOpen,
        actionsLabel,
        unreadIndicatorLabel,
        rowVariant,
        styles: {
          groupHeaderClassName: typography?.groupHeaderClassName,
          itemTitleClassName: typography?.itemTitleClassName,
          unreadItemTitleClassName: typography?.unreadItemTitleClassName,
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
        handleSelectConversation,
        getActions,
        onActionMenuOpen,
        actionsLabel,
        unreadIndicatorLabel,
        rowVariant,
        typography?.groupHeaderClassName,
        typography?.itemTitleClassName,
        typography?.unreadItemTitleClassName,
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

    /* Patterns 2.0: "No [entities] found" answers a search or a filter;
       "No [entities] yet" is for a list with neither applied. */
    const isNarrowed =
      searchQuery !== '' ||
      activeFilter !== FilterTab.All ||
      activeTypeFilter !== ConversationTypeFilter.All;
    const isListEmpty = filteredItems.length === 0;
    const isNoResults = isListEmpty && isNarrowed;
    const isEmpty = isListEmpty && !isNarrowed;
    /* A tab that alone narrows the list has no query to rephrase: the host can
       say what belongs in that tab instead (Shared falls back to
       `sharedEmptyDescription`). */
    const isTabOnlyNarrowed =
      isNoResults &&
      searchQuery === '' &&
      activeTypeFilter === ConversationTypeFilter.All;
    const tabEmptyLabel = isTabOnlyNarrowed
      ? tabEmptyLabels?.[activeFilter]
      : undefined;
    const currentNoResultsLabel = tabEmptyLabel?.label ?? noResultsLabel;
    const fallbackNoResultsDescription =
      activeFilter === FilterTab.Shared && searchQuery === ''
        ? sharedEmptyDescription
        : noResultsDescription;
    const currentNoResultsDescription =
      tabEmptyLabel?.description ?? fallbackNoResultsDescription;

    /*
     * Visible-row reporting. The last rendered range is kept so a change of
     * rows under an unchanged range (filtering, collapsing, new titles) is
     * reported too; the callback ref keeps `handleRowsRendered` stable.
     */
    const isListShown = !isLoading && !isListEmpty;
    const visibleRangeRef = useRef<{
      startIndex: number;
      stopIndex: number;
    } | null>(null);
    const reportedIdsRef = useRef<string[] | null>(null);
    const onVisibleIdsChangeRef = useRef(onVisibleConversationIdsChange);
    useEffect(() => {
      onVisibleIdsChangeRef.current = onVisibleConversationIdsChange;
    }, [onVisibleConversationIdsChange]);
    const reportVisibleIds = useCallback((ids: string[]) => {
      if (
        reportedIdsRef.current &&
        isSameIdSequence(reportedIdsRef.current, ids)
      ) {
        return;
      }
      reportedIdsRef.current = ids;
      onVisibleIdsChangeRef.current?.(ids);
    }, []);
    const handleRowsRendered = useCallback(
      (visibleRows: { startIndex: number; stopIndex: number }) => {
        visibleRangeRef.current = visibleRows;
        reportVisibleIds(getConversationIdsInRange(virtualRows, visibleRows));
      },
      [virtualRows, reportVisibleIds],
    );
    useEffect(() => {
      if (!isListShown) {
        visibleRangeRef.current = null;
        reportVisibleIds([]);
      } else if (visibleRangeRef.current) {
        reportVisibleIds(
          getConversationIdsInRange(virtualRows, visibleRangeRef.current),
        );
      }
    }, [isListShown, virtualRows, reportVisibleIds]);

    const getStatusMessage = (): string => {
      if (isLoading) return loadingLabel;
      if (isUpdatingTitles) return updatingTitlesLabel;
      if (isEmpty) return emptyLabel;
      if (isNoResults) return currentNoResultsLabel;
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
      if (isEmpty)
        return <PanelEmpty label={emptyLabel} description={emptyDescription} />;
      if (isNoResults && searchQuery !== '' && isUpdatingTitles)
        return <PanelEmpty label={updatingTitlesLabel} />;
      if (isNoResults)
        return (
          <PanelNoResults
            label={currentNoResultsLabel}
            description={currentNoResultsDescription}
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
          onRowsRendered={handleRowsRendered}
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
        <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
          {getStatusMessage()}
        </LiveRegion>
        {renderBody()}
      </div>
    );
  },
);
