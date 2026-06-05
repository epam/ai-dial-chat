import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo, useMemo, useState } from 'react';
import {
  ConversationSource,
  type ConversationPanelProps,
  FilterTab,
} from '../../models/ConversationPanel.js';
import { ConversationGroup } from '../ConversationGroup/ConversationGroup.js';
import { EmptyState } from '../EmptyState/EmptyState.js';
import { FilterTabs } from '../FilterTabs/FilterTabs.js';
import { NewChatButton } from '../NewChatButton/NewChatButton.js';
import { SearchInput } from '../SearchInput/SearchInput.js';
import styles from './ConversationPanel.module.scss';
import { Header } from './Header/Header.js';
import { matchesSearch, matchesTab } from './utils.js';

/** Collapsible left-side panel showing the user's conversation history. */
export const ConversationPanel: FC<ConversationPanelProps> = memo(
  ({
    conversations,
    isOpen,
    onSelectConversation,
    activeConversationId,
    title,
    emptyLabel,
    onNewChat,
    newChatLabel,
    searchPlaceholder,
    filterLabels,
    groupLabels,
    styles: panelStyles,
    className,
    onBackdropClick,
    getActions,
    actionsLabel,
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
            !item.isPinned && item.source !== ConversationSource.Shared && item.source !== ConversationSource.Organization,
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
          (item) => !item.isPinned && item.source === ConversationSource.Organization,
        ),
      [filteredItems],
    );

    const isEmpty = filteredItems.length === 0;

    return (
      <>
        {isOpen && onBackdropClick && (
          <div
            className="bg-black/40 fixed inset-0 z-40"
            aria-hidden="true"
            onClick={onBackdropClick}
          />
        )}

        <aside
          aria-label={title}
          aria-hidden={!isOpen}
          style={cssVars}
          className={mergeClasses(
            'relative z-50 flex h-full min-w-0 flex-shrink-0 flex-col overflow-hidden',
            'transition-[width] duration-200 ease-in-out',
            isOpen ? 'w-[320px] border-l border-r' : 'w-[0px]',
            styles.panel,
            className,
          )}
        >
          <Header title={title} titleClassName={typography?.fontClassName} />

          {/* New chat button */}
          <NewChatButton
            label={newChatLabel}
            onClick={onNewChat}
            labelClassName={typography?.newChatLabelClassName}
          />

          {/* Search */}
          <SearchInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={setSearchQuery}
          />

          {/* Filter tabs */}
          <FilterTabs
            activeTab={activeTab}
            labels={filterLabels}
            onChange={setActiveTab}
            tabClassName={typography?.tabClassName}
            tabColorClassName={typography?.tabColorClassName}
          />

          {/* Conversation list */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
            {isEmpty ? (
              <EmptyState
                label={emptyLabel}
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
                  itemIconClassName={typography?.itemIconClassName}
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
                  itemIconClassName={typography?.itemIconClassName}
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
                  itemIconClassName={typography?.itemIconClassName}
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
                  itemIconClassName={typography?.itemIconClassName}
                  itemTitleClassName={typography?.itemTitleClassName}
                />
              </>
            )}
          </div>
        </aside>
      </>
    );
  },
);
