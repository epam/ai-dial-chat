import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  PanelEmpty,
  PanelNoResults,
  SearchInput,
  SidebarPanel,
  SidebarSide,
} from '@epam/ai-dial-sidebar';
import { DialSkeleton } from '@epam/ai-dial-ui-kit';
import { type FC, memo, useMemo, useState } from 'react';
import {
  type ConversationPanelProps,
  ConversationSource,
  FilterTab,
} from '../../models/ConversationPanel';
import {
  getSkeletonWidth,
  SKELETON_ROW_COUNT,
} from '../../utils/conversation-row.utils';
import { ConversationGroup } from '../ConversationGroup/ConversationGroup';
import { FilterTabs } from '../FilterTabs/FilterTabs';
import { NewChatButton } from '../NewChatButton/NewChatButton';
import { matchesSearch, matchesTab } from './utils';

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

    const hasTypographyClass = Boolean(typography?.fontClassName);
    const cssVars = buildCssVars({
      '--cp-bg': colors?.background,
      '--cp-border': colors?.border,
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

        <div className="flex w-full flex-1 flex-col gap-2 overflow-y-auto px-2 py-1">
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
            <>
              <ConversationGroup
                label={groupLabels?.pinned ?? 'Pinned'}
                items={pinnedItems}
                activeConversationId={activeConversationId}
                onSelectConversation={onSelectConversation}
                getActions={getActions}
                actionsLabel={actionsLabel}
                groupHeaderClassName={typography?.groupHeaderClassName}
                itemTitleClassName={typography?.itemTitleClassName}
              />
              <ConversationGroup
                label={groupLabels?.myChats ?? 'My chats'}
                items={myChatsItems}
                activeConversationId={activeConversationId}
                onSelectConversation={onSelectConversation}
                getActions={getActions}
                actionsLabel={actionsLabel}
                groupHeaderClassName={typography?.groupHeaderClassName}
                itemTitleClassName={typography?.itemTitleClassName}
              />
              <ConversationGroup
                label={groupLabels?.shared ?? 'Shared'}
                items={sharedItems}
                activeConversationId={activeConversationId}
                onSelectConversation={onSelectConversation}
                getActions={getActions}
                actionsLabel={actionsLabel}
                groupHeaderClassName={typography?.groupHeaderClassName}
                itemTitleClassName={typography?.itemTitleClassName}
              />
              <ConversationGroup
                label={groupLabels?.organization ?? 'Organization'}
                items={organizationItems}
                activeConversationId={activeConversationId}
                onSelectConversation={onSelectConversation}
                getActions={getActions}
                actionsLabel={actionsLabel}
                groupHeaderClassName={typography?.groupHeaderClassName}
                itemTitleClassName={typography?.itemTitleClassName}
              />
            </>
          )}
        </div>
      </SidebarPanel>
    );
  },
);
