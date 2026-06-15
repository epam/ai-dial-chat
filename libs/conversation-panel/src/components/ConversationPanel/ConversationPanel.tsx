import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  PanelEmpty,
  PanelNoResults,
  SearchInput,
  SidebarPanel,
  SidebarSide,
} from '@epam/ai-dial-sidebar';
import { DialSkeleton } from '@epam/ai-dial-ui-kit';
import { type FC, memo, useCallback, useMemo, useState } from 'react';
import { List } from 'react-window';
import { ITEM_ROW_HEIGHT } from '../../constants/virtual-list';
import {
  ConversationGroupKey,
  type ConversationPanelProps,
  ConversationSource,
  FilterTab,
} from '../../models/ConversationPanel';
import {
  type RowRendererData,
  type VirtualRow,
  VirtualRowKind,
} from '../../models/virtual-row';
import {
  getRowHeight,
  getSkeletonWidth,
  SKELETON_ROW_COUNT,
} from '../../utils/conversation-row.utils';
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
  }) => {
    const { colors, typography } = panelStyles ?? {};
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<FilterTab>(FilterTab.All);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
      () => ALL_GROUP_KEYS,
    );
    const [overscanCount, setOverscanCount] = useState(5);

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

    const hasTypographyClass = Boolean(typography?.fontClassName);
    const cssVars = buildCssVars({
      '--cp-bg': colors?.background,
      '--sb-border': colors?.border,
      '--cp-header-border': colors?.headerBorder,
      '--cp-item-hover': colors?.itemHover,
      '--cp-item-active': colors?.itemActive,
      '--cp-text': colors?.text,
      '--cp-text-secondary': colors?.textSecondary,
      '--cp-new-chat-hover': colors?.newChatHoverBackground,
      '--cp-new-chat-active': colors?.newChatActiveBackground,
      '--cp-new-chat-icon-bg': colors?.newChatIconBackground,
      '--cp-new-chat-icon-bg-hover': colors?.newChatIconBackgroundHover,
      '--cp-new-chat-icon-bg-active': colors?.newChatIconBackgroundActive,
      '--cp-new-chat-icon': colors?.newChatIconColor,
      '--cp-new-chat-radius': colors?.newChatBorderRadius,
      '--cp-new-chat-divider': colors?.newChatDivider,
      '--cp-title-font-family': hasTypographyClass
        ? undefined
        : typography?.fontFamily,
      '--cp-title-font-size': hasTypographyClass
        ? undefined
        : typography?.fontSize,
      '--cp-title-font-weight': hasTypographyClass
        ? undefined
        : typography?.fontWeight?.toString(),
      '--cp-title-line-height': hasTypographyClass
        ? undefined
        : typography?.lineHeight,
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
            rows.push({ kind: VirtualRowKind.Item, item });
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
      ],
    );

    const isNoConversations = conversations.length === 0;
    const isNoResults = conversations.length > 0 && filteredItems.length === 0;

    return (
      <SidebarPanel
        isOpen={isOpen}
        side={SidebarSide.Left}
        title={title}
        titleClassName={typography?.fontClassName}
        ariaLabel={title}
        onClose={onToggle}
        closeLabel={closeAriaLabel}
        styles={{
          colors: {
            background: colors?.background,
            border: colors?.border,
            headerBorder: colors?.headerBorder,
          },
          typography: {
            fontClassName: typography?.fontClassName,
            fontFamily: hasTypographyClass ? undefined : typography?.fontFamily,
            fontSize: hasTypographyClass ? undefined : typography?.fontSize,
          },
        }}
        className={mergeClasses(
          isOpen
            ? resizable
              ? 'border-l border-r mobile:w-full'
              : 'w-[325px] border-l border-r mobile:w-full'
            : 'w-0',
          className,
        )}
        bodyClassName="flex flex-col overflow-hidden p-0"
        cssVars={cssVars}
        resizable={resizable}
        defaultWidth={defaultPanelWidth}
        minWidth={minPanelWidth}
        maxWidth={maxPanelWidth}
        onResizeStop={onPanelResizeStop}
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
        />

        <FilterTabs
          activeTab={activeTab}
          labels={filterLabels}
          onChange={setActiveTab}
          tabClassName={typography?.tabClassName}
          tabColorClassName={typography?.tabColorClassName}
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
            <PanelEmpty
              label={emptyLabel}
              labelClassName={typography?.emptyLabelClassName}
            />
          ) : isNoResults ? (
            <PanelNoResults
              label={noResultsLabel}
              labelClassName={typography?.emptyLabelClassName}
            />
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
