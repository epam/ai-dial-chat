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
  useMemo,
  useRef,
  useState,
} from 'react';
import { List } from 'react-window';
import { ITEM_ROW_HEIGHT } from '../../constants/virtual-list';
import { ConversationPanelProps } from '../../models/panel-props';
import {
  type RowRendererData,
  type VirtualRow,
  VirtualRowKind,
} from '../../models/virtual-row';
import { ConversationGroupKey } from '../../types/conversation-group-key';
import { ConversationSource } from '../../types/conversation-source';
import { FilterTab } from '../../types/filter-tab';
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
import { matchesSearch, matchesTab } from './utils';

const ALL_GROUP_KEYS = new Set<string>(Object.values(ConversationGroupKey));

/** Collapsible left-side panel showing the user's conversation history. */
export const ConversationPanel: FC<ConversationPanelProps> = memo(
  ({
    conversations,
    isLoading,
    isOpen,
    onSelectConversation,
    activeConversationId,
    title,
    emptyLabel,
    noResultsLabel,
    onNewChat,
    newChatLabel,
    searchPlaceholder,
    searchClearLabel,
    filterLabels,
    groupLabels,
    styles: panelStyles,
    className,
    getActions,
    actionsLabel,
    onToggle,
    closeAriaLabel,
    resizable,
    defaultPanelWidth = 325,
    minPanelWidth = 312,
    maxPanelWidth = 600,
    onPanelResizeStop,
    headerActions,
    onMoveConversation,
    activeFilter,
    onActiveFilterChange,
  }) => {
    const { colors, typography } = panelStyles ?? {};
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(FilterTab.All);

    useEffect(() => {
      if (activeFilter == null) return;
      setActiveTab(activeFilter);
      onActiveFilterChange?.(activeFilter);
    }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
      () => ALL_GROUP_KEYS,
    );
    const [overscanCount, setOverscanCount] = useState(5);

    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [allowedDropGroups, setAllowedDropGroups] =
      useState<Set<ConversationGroupKey> | null>(null);

    /*
     * Refs let the drop handler read current values without being in the useCallback dep array,
     * avoiding recreating the handler (and remounting rows) on every drag-state change.
     */
    const draggingIdRef = useRef<string | null>(null);
    const allowedDropGroupsRef = useRef<Set<ConversationGroupKey> | null>(null);

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
      (
        targetId: string,
        targetGroupKey: ConversationGroupKey,
        afterId: string | null,
      ) => {
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
      '--cp-bg': colors?.background,
      '--sb-border': colors?.border,
      '--cp-item-hover': colors?.itemHover,
      '--cp-item-active': colors?.itemActive,
      '--cp-text': colors?.text,
      '--cp-text-secondary': colors?.textSecondary,
      '--cp-new-chat-hover': colors?.newChatHoverBackground,
      '--cp-new-chat-active': colors?.newChatActiveBackground,
      '--cp-new-chat-icon-bg': colors?.newChatIconBackground,
      '--cp-new-chat-icon-bg-hover': colors?.newChatIconBackgroundHover,
      '--cp-new-chat-icon-bg-active': colors?.newChatIconBackgroundActive,
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
            item.source !== ConversationSource.Shared &&
            item.source !== ConversationSource.Organization,
        ),
      [filteredItems],
    );

    const sharedItems = useMemo(
      () =>
        filteredItems.filter(
          (item) => !item.isPinned && item.source === ConversationSource.Shared,
        ),
      [filteredItems],
    );

    const organizationItems = useMemo(
      () =>
        filteredItems.filter(
          (item) =>
            !item.isPinned && item.source === ConversationSource.Organization,
        ),
      [filteredItems],
    );

    const groups = useMemo(
      () => [
        {
          key: ConversationGroupKey.Pinned,
          label: groupLabels?.pinned ?? 'Pinned',
          items: pinnedItems,
        },
        {
          key: ConversationGroupKey.MyChats,
          label: groupLabels?.myChats ?? 'My chats',
          items: myChatsItems,
        },
        {
          key: ConversationGroupKey.Shared,
          label: groupLabels?.shared ?? 'Shared',
          items: sharedItems,
        },
        {
          key: ConversationGroupKey.Organization,
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

    const rowProps = useMemo<RowRendererData>(
      () => ({
        rows: virtualRows,
        expandedGroups,
        onToggleGroup: handleToggleGroup,
        activeConversationId,
        onSelectConversation,
        getActions,
        actionsLabel,
        groupHeaderClassName: typography?.groupHeaderClassName,
        itemTitleClassName: typography?.itemTitleClassName,
        itemIconBadgeClassName: typography?.itemIconBadgeClassName,
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
        activeConversationId,
        onSelectConversation,
        getActions,
        actionsLabel,
        typography?.groupHeaderClassName,
        typography?.itemTitleClassName,
        typography?.itemIconBadgeClassName,
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
        ariaLabel={title}
        onClose={onToggle}
        closeLabel={closeAriaLabel}
        headerClassName="h-[64px]"
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
        }}
        className={mergeClasses(
          isOpen
            ? resizable
              ? 'border-l border-r mobile:w-full'
              : 'w-[325px] border-l border-r mobile:w-full'
            : 'w-0',
          className,
        )}
        resizable={resizable}
        defaultWidth={defaultPanelWidth}
        minWidth={minPanelWidth}
        maxWidth={maxPanelWidth}
        onResizeStop={onPanelResizeStop}
        rightActions={headerActions}
      >
        <NewChatButton
          label={newChatLabel}
          onClick={onNewChat}
          labelClassName={typography?.newChatLabelClassName}
        />

        <SearchInput
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={setSearchQuery}
          clearLabel={searchClearLabel}
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
                  color="var(--bg-layer-4)"
                />
              ))}
            </div>
          ) : isNoConversations ? (
            <PanelEmpty label={emptyLabel} />
          ) : isNoResults ? (
            <PanelNoResults label={noResultsLabel} />
          ) : (
            <List<RowRendererData>
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
